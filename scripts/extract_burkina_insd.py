#!/usr/bin/env python3
"""
MANSA Terminal — Extraction des Annuaires Statistiques Nationaux du Burkina Faso (INSD).

Lit les PDF des annuaires statistiques nationaux (INSD) et en extrait les
**tableaux séries-temporelles** (en-tête contenant des colonnes d'années) vers un
CSV aligné sur la table `macro_indicators`. Le CSV est ensuite ingéré par
`scripts/ingest_burkina_insd.py` (source = INSD).

Pourquoi une extraction par position de mots plutôt que `extract_tables()` ?
  Les tableaux des annuaires sont *sans bordures* : pdfplumber fusionne alors les
  colonnes d'années dans une seule cellule, et l'espace y sert à la fois de
  séparateur de milliers (« 10 621,5 ») et de séparateur de colonnes. On
  reconstruit donc les colonnes à partir des positions x des mots, en s'alignant
  sur les positions des années de l'en-tête — ce qui lève l'ambiguïté.

Le filtre « en-tête = ≥3 années » restreint *de facto* aux vraies séries
temporelles (comptabilité nationale, prix, finances publiques, commerce, dette,
production agricole/minière, démographie, santé/éducation…) et exclut les
tableaux croisés géographiques (colonnes = provinces) non pertinents pour un
terminal macro.

Usage :
    python scripts/extract_burkina_insd.py \
        --pdf-dir "C:/Users/.../Downloads" \
        --out data/burkina_insd/insd_burkina.csv

Dépendances : pdfplumber, unidecode  (pip install pdfplumber unidecode)
"""
from __future__ import annotations

import argparse
import csv
import glob
import hashlib
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass

# Évite les UnicodeEncodeError sur les consoles Windows (cp1252) face aux emojis.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    pass

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber manquant :  pip install pdfplumber")

try:
    from unidecode import unidecode
except ImportError:  # repli : on garde les libellés tels quels (accents → ?)
    def unidecode(s: str) -> str:  # type: ignore
        return s

SOURCE = "INSD"
SOURCE_URL = "https://www.insd.bf"
COUNTRY = "BFA"

YEAR_RE = re.compile(r"^(19|20)\d{2}$")
MIN_YEAR, MAX_YEAR = 1985, 2026  # plage plausible des colonnes d'années des annuaires


def is_year(text: str) -> bool:
    return bool(YEAR_RE.match(text)) and MIN_YEAR <= int(text) <= MAX_YEAR
# Un mot « numérique » : chiffres, virgule décimale, signe, séparateurs.
NUM_WORD_RE = re.compile(r"^[-+]?\d[\d.,]*$")
TABLE_TITLE_RE = re.compile(r"Tableau\s+(\d+)\.(\d+)\.(\d+)\s*:?\s*(.*)", re.IGNORECASE)
# Bruit de pied de page / source à ignorer.
NOISE_RE = re.compile(r"^(Source|Institut national|Minist|Note|Graphique)\b", re.IGNORECASE)

# Restauration ciblée des accents perdus (encodage CID → « � »). unidecode ne
# peut rien faire d'un « � » ; on répare donc quelques motifs fréquents avant.
MOJIBAKE = {
    "�": "",  # caractère de remplacement résiduel : on le retire
}


@dataclass
class Point:
    indicator_code: str
    indicator_name: str
    value: float
    unit: str | None
    period: str
    table_ref: str
    book_year: int


def clean_label(raw: str) -> str:
    s = raw
    for bad, good in MOJIBAKE.items():
        s = s.replace(bad, good)
    s = re.sub(r"\s+", " ", s).strip(" .:-—–")
    return s


def slugify(label: str, limit: int = 32) -> str:
    s = unidecode(label).lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:limit].strip("_")


def make_code(part: str, chap: str, sub: str, label: str) -> str:
    """Code déterministe ≤ 50 caractères : INSD_<p>_<chap>_<slug|hash>."""
    base = f"INSD_{part}_{chap}_{sub}_"
    slug = slugify(label, 50 - len(base))
    code = base + slug
    if len(code) <= 50 and slug:
        return code
    h = hashlib.md5(f"{part}.{chap}.{sub}:{label}".encode()).hexdigest()[:8]
    return f"INSD_{part}_{chap}_{sub}_{h}"[:50]


def parse_number(tokens: list[str]) -> float | None:
    """Joint les mots d'une même colonne et renvoie un float (ou None si manquant).

    Gère : séparateur de milliers = espace (joint), décimale = virgule,
    valeurs manquantes « - » / « … » / vide, signe négatif éventuellement
    détaché (« - 5,3 »).
    """
    if not tokens:
        return None
    joined = "".join(tokens)
    if joined in {"-", "--", "...", "…", "nd", "ND", "n.d.", ""}:
        return None
    neg = joined.startswith("-")
    joined = joined.lstrip("+-")
    joined = joined.replace(" ", "").replace(" ", "")
    # Décimale française : dernière virgule = séparateur décimal.
    if "," in joined:
        intpart, _, dec = joined.rpartition(",")
        intpart = intpart.replace(",", "").replace(".", "")
        joined = f"{intpart}.{dec}"
    else:
        joined = joined.replace(".", "")  # points = milliers
    try:
        v = float(joined)
    except ValueError:
        return None
    return -v if neg else v


def unit_from_title(title: str) -> str | None:
    t = title.lower()
    if "pourcentage" in t or "taux" in t or "%" in t:
        return "%"
    if "milliard" in t:
        return "Mds FCFA"
    if "million" in t and "fcfa" in t:
        return "M FCFA"
    if "fcfa" in t or "f cfa" in t:
        return "FCFA"
    if "tonne" in t:
        return "tonnes"
    if "millier" in t:
        return "milliers"
    if "nombre" in t or "effectif" in t:
        return "nombre"
    m = re.search(r"\(en ([^)]+)\)", title)
    if m:
        return clean_label(m.group(1))[:30] or None
    return None


def cluster_lines(words: list[dict], y_tol: float = 3.0) -> list[list[dict]]:
    """Regroupe les mots en lignes par coordonnée verticale (top)."""
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(w["top"] - lines[-1][0]["top"]) <= y_tol:
            lines[-1].append(w)
        else:
            lines.append([w])
    for ln in lines:
        ln.sort(key=lambda w: w["x0"])
    return lines


COL_GAP = 9.0  # écart x (px) au-delà duquel deux mots = deux colonnes distinctes
VALUE_ABS_MAX = 1e12  # garde-fou : aucune valeur INSD plausible au-delà


def split_label_nums(line: list[dict], first_anchor_x: float):
    """Sépare une ligne en (mots-libellé à gauche, mots de la zone valeurs à droite)."""
    label_w, num_w = [], []
    for w in line:
        xc = (w["x0"] + w["x1"]) / 2
        if xc >= first_anchor_x - 22 and (NUM_WORD_RE.match(w["text"]) or w["text"] in {"-", "…", "...", "nd", "ND"}):
            num_w.append(w)
        else:
            label_w.append(w)
    return label_w, num_w


def number_groups(num_words: list[dict]) -> list[tuple[float, float | None]]:
    """Reconstruit des nombres en groupant les mots proches en x.

    Un séparateur de milliers (« 10 621,5 ») laisse un petit écart → même groupe.
    Un changement de colonne laisse un grand écart → nouveau groupe.
    Renvoie [(x_centre, valeur|None)]. Un « - » isolé = valeur manquante (None).
    """
    groups: list[list[dict]] = []
    for w in sorted(num_words, key=lambda w: w["x0"]):
        if groups and (w["x0"] - groups[-1][-1]["x1"]) <= COL_GAP:
            groups[-1].append(w)
        else:
            groups.append([w])
    out: list[tuple[float, float | None]] = []
    for g in groups:
        xc = (g[0]["x0"] + g[-1]["x1"]) / 2
        toks = [w["text"] for w in g]
        val = parse_number(toks)
        out.append((xc, val))
    return out


def assign_strict(num_words: list[dict], anchors: list[tuple[str, float]]) -> dict[str, float] | None:
    """Mappe les valeurs aux années **uniquement si le nombre de valeurs == le
    nombre de colonnes-années** (appariement positionnel 1:1, gauche→droite, sans
    ambiguïté).

    Les tables économiques sont denses (chaque année a une valeur) → appariement
    parfait. Les tables sociales éparses (valeurs manquantes sans marqueur)
    donneraient des associations erronées → on les écarte ici ; ces indicateurs
    sont couverts par la couche « chiffres clés » vérifiée à la main.
    """
    groups = number_groups(num_words)
    if len(groups) != len(anchors):
        return None
    cols: dict[str, float] = {}
    for (year, _), (_, val) in zip(anchors, groups):
        if val is not None:
            cols[year] = val
    return cols


def extract_page(page, part_chap_sub: list[str], book_year: int) -> list[Point]:
    words = page.extract_words(x_tolerance=1.5, keep_blank_chars=False)
    if not words:
        return []
    lines = cluster_lines(words)

    points: list[Point] = []
    cur_title = ""
    cur_ref = ""
    cur_part = cur_chap = cur_sub = "0"
    anchors: list[tuple[str, float]] = []
    pending_label = ""       # libellé d'une ligne sans valeurs, à rattacher
    pending_bottom = -1e9    # y-bas de cette ligne-libellé (pour l'adjacence)
    LINE_GAP = 16.0          # écart vertical max pour considérer deux lignes adjacentes

    for ln in lines:
        texts = [w["text"] for w in ln]
        joined = " ".join(texts)
        line_top = min(w["top"] for w in ln)
        line_bottom = max(w["bottom"] for w in ln)

        m = TABLE_TITLE_RE.search(joined)
        if m:
            cur_part, cur_chap, cur_sub, rest = m.groups()
            cur_ref = f"{cur_part}.{cur_chap}.{cur_sub}"
            cur_title = clean_label(rest)
            anchors = []
            pending_label = ""
            continue

        if cur_title and not anchors and TABLE_TITLE_RE.search("") is None:
            # Titre possiblement sur 2 lignes (suite sans « Tableau »).
            if not any(NUM_WORD_RE.match(t) for t in texts) and len(joined) < 90 \
                    and "(" in joined and not anchors:
                cur_title = clean_label(cur_title + " " + joined)

        year_words = [w for w in ln if is_year(w["text"])]
        if len(year_words) >= 3:
            anchors = [(w["text"], (w["x0"] + w["x1"]) / 2) for w in year_words]
            anchors.sort(key=lambda a: a[1])
            pending_label = ""
            continue

        if not anchors or not cur_ref:
            continue
        if NOISE_RE.match(joined):
            anchors = []
            continue

        # Glyphe non décodé (ex. séparateur de milliers rendu « (cid:3031) ») →
        # le découpage des nombres est cassé sur cette ligne : on l'ignore.
        if "(cid:" in joined:
            continue

        first_x = anchors[0][1]
        label_w, num_w = split_label_nums(ln, first_x)
        label = clean_label(" ".join(w["text"] for w in label_w))

        if not num_w:
            # Ligne de libellé seule → mémoriser pour la prochaine ligne de valeurs,
            # uniquement si elle prolonge un libellé adjacent (sinon on repart).
            if label:
                if pending_label and line_top - pending_bottom <= LINE_GAP:
                    pending_label = (pending_label + " " + label).strip()
                else:
                    pending_label = label
                pending_bottom = line_bottom
            continue

        # On ne rattache un libellé en attente que s'il est *verticalement adjacent*
        # à cette ligne de valeurs — évite d'associer un libellé orphelin (issu
        # d'une ligne éparse rejetée plus haut) à des valeurs sans rapport.
        carry = pending_label if (pending_label and line_top - pending_bottom <= LINE_GAP) else ""
        pending_label = ""
        full_label = clean_label((carry + " " + label).strip())
        if not full_label or sum(c.isalpha() for c in full_label) < 2:
            continue
        # Un nombre à ≥2 chiffres dans le libellé = une valeur a fui dans le texte
        # (mauvais découpage) → ligne douteuse, on l'écarte.
        if re.search(r"\d{2,}", full_label):
            continue

        cols = assign_strict(num_w, anchors)
        if cols is None:
            # Ligne éparse/désalignée : ses valeurs lui appartiennent → on n'en
            # fait PAS un libellé en attente (ce serait une fausse association).
            continue
        n_ok = 0
        unit = unit_from_title(cur_title)
        code = make_code(cur_part, cur_chap, cur_sub, full_label)
        for year, _ in anchors:
            val = cols.get(year)
            if val is None or abs(val) > VALUE_ABS_MAX:
                continue
            points.append(Point(code, full_label[:200], val, unit, year, cur_ref, book_year))
            n_ok += 1

    return points


def book_year_of(path: str) -> int:
    m = re.search(r"(20\d{2})", os.path.basename(path))
    return int(m.group(1)) if m else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Extraction Annuaires INSD Burkina → CSV")
    ap.add_argument("--pdf-dir", required=True, help="Dossier contenant les PDF des annuaires")
    ap.add_argument("--glob", default="*nnuaire*atistique*ational*.pdf",
                    help="Motif des fichiers PDF")
    ap.add_argument("--out", default="data/burkina_insd/insd_burkina.csv")
    ap.add_argument("--max-pages", type=int, default=0, help="Limiter (debug)")
    args = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(args.pdf_dir, args.glob)))
    if not paths:
        sys.exit(f"Aucun PDF trouvé : {os.path.join(args.pdf_dir, args.glob)}")

    # On garde, pour chaque (indicator_code, period), la valeur du livre le plus
    # récent (révisions plus fiables). best[(code, period)] = (book_year, Point)
    best: dict[tuple[str, str], tuple[int, Point]] = {}
    per_book: dict[int, int] = defaultdict(int)

    for path in paths:
        by = book_year_of(path)
        print(f"📘 {os.path.basename(path)}  (édition {by})")
        with pdfplumber.open(path) as pdf:
            pages = pdf.pages[: args.max_pages] if args.max_pages else pdf.pages
            for i, page in enumerate(pages):
                try:
                    pts = extract_page(page, [], by)
                except Exception as exc:  # noqa: BLE001
                    print(f"  ⚠ page {i+1}: {exc}")
                    continue
                for p in pts:
                    key = (p.indicator_code, p.period)
                    if key not in best or by >= best[key][0]:
                        best[key] = (by, p)
                        per_book[by] += 1
                if (i + 1) % 50 == 0:
                    print(f"  …page {i+1}/{len(pages)} — {len(best)} séries-points")

    rows = [p for _, p in best.values()]
    rows.sort(key=lambda p: (p.table_ref, p.indicator_name, p.period))

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["country_id", "indicator_code", "indicator_name", "value",
                    "unit", "period", "period_type", "source", "source_url",
                    "table_ref", "book_year"])
        for p in rows:
            w.writerow([COUNTRY, p.indicator_code, p.indicator_name, p.value,
                        p.unit or "", p.period, "annual", SOURCE, SOURCE_URL,
                        p.table_ref, p.book_year])

    n_codes = len({p.indicator_code for p in rows})
    years = sorted({p.period for p in rows})
    print("\n" + "=" * 60)
    print(f"✅ {len(rows)} points · {n_codes} indicateurs distincts")
    print(f"   Années couvertes : {years[0] if years else '—'} → {years[-1] if years else '—'}")
    print(f"   CSV : {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
