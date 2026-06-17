#!/usr/bin/env python3
"""
MANSA Terminal — ACLED : vérification d'accès + aperçu des données
==================================================================

ACLED (nouveau portail 2024) n'utilise PAS de clé API séparée : on
s'authentifie avec **l'email + le mot de passe du compte** via OAuth, ce qui
renvoie un jeton temporaire, utilisé ensuite pour lire les données.

Ce script (à lancer DEPUIS TA MACHINE) :
  1. récupère un jeton OAuth avec tes identifiants ;
  2. télécharge un échantillon récent d'événements ;
  3. affiche les conflits agrégés par pays africain.

Tes identifiants restent en local (variables d'environnement) — jamais commités.

Usage (cmd.exe) :
    set "ACLED_EMAIL=ton.email@gmail.com"
    set "ACLED_PASSWORD=ton_mot_de_passe_acled"
    python data\\pipelines\\ingest_conflicts.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    pass

OAUTH_URL = "https://acleddata.com/oauth/token"
READ_URL = "https://acleddata.com/api/acled/read"
# En-têtes navigateur : le endpoint de lecture est derrière un WAF qui renvoie
# 403 aux User-Agent non navigateur (même comportement que l'API World Bank).
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Régions ACLED considérées comme africaines
AFRICAN_REGIONS = {
    "Western Africa", "Middle Africa", "Eastern Africa",
    "Southern Africa", "Northern Africa",
}


def get_token(email: str, password: str) -> str:
    data = urllib.parse.urlencode({
        "username": email,
        "password": password,
        "grant_type": "password",
        "client_id": "acled",
        "scope": "authenticated",
    }).encode()
    req = urllib.request.Request(OAUTH_URL, data=data, headers={
        **HEADERS, "Content-Type": "application/x-www-form-urlencoded",
    })
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            tok = json.loads(r.read().decode("utf-8")).get("access_token")
            if not tok:
                sys.exit("❌ Jeton absent dans la réponse OAuth.")
            return tok
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        body = e.read().decode("utf-8", "replace")
        if e.code == 400 and "invalid_grant" in body:
            sys.exit("❌ Identifiants ACLED incorrects (email ou mot de passe).")
        sys.exit(f"❌ Erreur OAuth {e.code} : {body[:200]}")


def fetch_sample(token: str, limit: int = 3000) -> list[dict]:
    qs = urllib.parse.urlencode({"_format": "json", "limit": limit})
    req = urllib.request.Request(f"{READ_URL}?{qs}", headers={
        **HEADERS, "Authorization": f"Bearer {token}",
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            payload = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        body = e.read().decode("utf-8", "replace")
        print(f"\n❌ Lecture refusée — HTTP {e.code}")
        print(f"   Réponse du serveur : {body[:300]}")
        if e.code == 403:
            print("\n   ➜ Ton jeton est valide mais l'accès aux données est refusé.")
            print("     Va sur acleddata.com/myacled et vérifie :")
            print("       • qu'une section « API Access » / « Access » est ACTIVÉE,")
            print("       • que tu as accepté les conditions d'utilisation / la licence,")
            print("       • ou qu'une demande d'accès API doit être validée.")
        sys.exit(1)
    # ACLED renvoie soit {"data":[...]} soit une liste directe selon la version
    if isinstance(payload, dict):
        return payload.get("data") or payload.get("results") or []
    return payload if isinstance(payload, list) else []


def main() -> int:
    email = os.getenv("ACLED_EMAIL")
    password = os.getenv("ACLED_PASSWORD")
    if not email or not password:
        sys.exit("❌ Définis ACLED_EMAIL et ACLED_PASSWORD dans l'environnement.")

    print("🔑 Authentification ACLED…")
    token = get_token(email, password)
    print("✅ Jeton obtenu. Téléchargement d'un échantillon récent…")

    events = fetch_sample(token)
    print(f"   {len(events)} événements reçus.")

    by_country: dict[str, dict] = defaultdict(lambda: {"events": 0, "fatalities": 0})
    for e in events:
        if e.get("region") not in AFRICAN_REGIONS:
            continue
        c = e.get("country", "?")
        by_country[c]["events"] += 1
        try:
            by_country[c]["fatalities"] += int(float(e.get("fatalities", 0) or 0))
        except (TypeError, ValueError):
            pass

    if not by_country:
        print("⚠ Aucun événement africain dans l'échantillon (essaie une limite plus élevée).")
        return 0

    top = sorted(by_country.items(), key=lambda kv: kv[1]["fatalities"], reverse=True)
    print(f"\n📊 Conflits africains dans l'échantillon ({len(by_country)} pays) :")
    print(f"   {'Pays':<28}{'Événements':>12}{'Morts':>10}")
    for country, agg in top[:20]:
        print(f"   {country:<28}{agg['events']:>12}{agg['fatalities']:>10}")

    print("\n✅ Accès ACLED confirmé. Copie-moi ces lignes (sans tes identifiants) "
          "et je branche l'ingestion complète vers la page Conflits.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
