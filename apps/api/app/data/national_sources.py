"""
MANSA Terminal — Catalogue des sources nationales par pays.

Référence les institutions productrices de statistiques propres à chaque pays :
  - Institut national de statistique (ex. INSD pour le Burkina Faso)
  - Banque centrale (ex. BCEAO pour la zone UEMOA, BEAC pour la CEMAC)
  - Autres sources officielles (trésor, ministère des finances)

Ces métadonnées alimentent l'endpoint `/api/macro/{country_id}/national-sources`
qui les combine avec les séries `macro_indicators` taggées d'une source nationale
(ingérées par `data/pipelines/central_banks_pipeline.py`).
"""
from __future__ import annotations

# ============================================================
# Zones monétaires
# ============================================================
UEMOA = {"SEN", "CIV", "MLI", "BFA", "NER", "TGO", "BEN", "GNB"}
CEMAC = {"CMR", "TCD", "CAF", "COG", "GAB", "GNQ"}

BCEAO = {
    "name": "Banque Centrale des États de l'Afrique de l'Ouest",
    "abbrev": "BCEAO",
    "url": "https://www.bceao.int",
}
BEAC = {
    "name": "Banque des États de l'Afrique Centrale",
    "abbrev": "BEAC",
    "url": "https://www.beac.int",
}

# Banques centrales nationales (hors zones franc CFA)
CENTRAL_BANKS: dict[str, dict] = {
    "NGA": {"name": "Central Bank of Nigeria",              "abbrev": "CBN",  "url": "https://www.cbn.gov.ng"},
    "ZAF": {"name": "South African Reserve Bank",           "abbrev": "SARB", "url": "https://www.resbank.co.za"},
    "EGY": {"name": "Central Bank of Egypt",                "abbrev": "CBE",  "url": "https://www.cbe.org.eg"},
    "MAR": {"name": "Bank Al-Maghrib",                      "abbrev": "BAM",  "url": "https://www.bkam.ma"},
    "KEN": {"name": "Central Bank of Kenya",                "abbrev": "CBK",  "url": "https://www.centralbank.go.ke"},
    "GHA": {"name": "Bank of Ghana",                        "abbrev": "BoG",  "url": "https://www.bog.gov.gh"},
    "TUN": {"name": "Banque Centrale de Tunisie",           "abbrev": "BCT",  "url": "https://www.bct.gov.tn"},
    "ETH": {"name": "National Bank of Ethiopia",            "abbrev": "NBE",  "url": "https://nbe.gov.et"},
    "TZA": {"name": "Bank of Tanzania",                     "abbrev": "BoT",  "url": "https://www.bot.go.tz"},
    "UGA": {"name": "Bank of Uganda",                       "abbrev": "BoU",  "url": "https://www.bou.or.ug"},
    "RWA": {"name": "National Bank of Rwanda",              "abbrev": "BNR",  "url": "https://www.bnr.rw"},
    "ZMB": {"name": "Bank of Zambia",                       "abbrev": "BoZ",  "url": "https://www.boz.zm"},
    "MOZ": {"name": "Banco de Moçambique",                  "abbrev": "BdM",  "url": "https://www.bancomoc.mz"},
    "DZA": {"name": "Banque d'Algérie",                     "abbrev": "BA",   "url": "https://www.bank-of-algeria.dz"},
    "AGO": {"name": "Banco Nacional de Angola",             "abbrev": "BNA",  "url": "https://www.bna.ao"},
    "MUS": {"name": "Bank of Mauritius",                    "abbrev": "BoM",  "url": "https://www.bom.mu"},
    "BWA": {"name": "Bank of Botswana",                     "abbrev": "BoB",  "url": "https://www.bankofbotswana.bw"},
    "NAM": {"name": "Bank of Namibia",                      "abbrev": "BoN",  "url": "https://www.bon.com.na"},
    "ZWE": {"name": "Reserve Bank of Zimbabwe",             "abbrev": "RBZ",  "url": "https://www.rbz.co.zw"},
    "MWI": {"name": "Reserve Bank of Malawi",               "abbrev": "RBM",  "url": "https://www.rbm.mw"},
    "MDG": {"name": "Banky Foiben'i Madagasikara",          "abbrev": "BFM",  "url": "https://www.banky-foibe.mg"},
    "SLE": {"name": "Bank of Sierra Leone",                 "abbrev": "BSL",  "url": "https://www.bsl.gov.sl"},
    "LBR": {"name": "Central Bank of Liberia",              "abbrev": "CBL",  "url": "https://www.cbl.org.lr"},
    "GMB": {"name": "Central Bank of The Gambia",           "abbrev": "CBG",  "url": "https://www.cbg.gm"},
    "GIN": {"name": "Banque Centrale de la République de Guinée", "abbrev": "BCRG", "url": "https://www.bcrg-guinee.org"},
    "SDN": {"name": "Central Bank of Sudan",                "abbrev": "CBoS", "url": "https://cbos.gov.sd"},
    "SUD": {"name": "Central Bank of Sudan",                "abbrev": "CBoS", "url": "https://cbos.gov.sd"},
}

# ============================================================
# Instituts nationaux de la statistique
# ============================================================
NATIONAL_STATS_INSTITUTES: dict[str, dict] = {
    # — UEMOA —
    "BFA": {"name": "Institut National de la Statistique et de la Démographie", "abbrev": "INSD",   "url": "https://www.insd.bf"},
    "SEN": {"name": "Agence Nationale de la Statistique et de la Démographie",   "abbrev": "ANSD",   "url": "https://www.ansd.sn"},
    "CIV": {"name": "Institut National de la Statistique",                       "abbrev": "INS",    "url": "https://www.ins.ci"},
    "MLI": {"name": "Institut National de la Statistique",                       "abbrev": "INSTAT", "url": "https://www.instat-mali.org"},
    "NER": {"name": "Institut National de la Statistique",                       "abbrev": "INS",    "url": "https://www.stat-niger.org"},
    "BEN": {"name": "Institut National de la Statistique et de la Démographie",  "abbrev": "INStaD", "url": "https://instad.bj"},
    "TGO": {"name": "Institut National de la Statistique et des Études Économiques et Démographiques", "abbrev": "INSEED", "url": "https://inseed.tg"},
    "GNB": {"name": "Instituto Nacional de Estatística",                         "abbrev": "INE",    "url": "https://www.stat-guinebissau.com"},
    # — CEMAC —
    "CMR": {"name": "Institut National de la Statistique",                       "abbrev": "INS",    "url": "https://ins-cameroun.cm"},
    "TCD": {"name": "Institut National de la Statistique, des Études Économiques et Démographiques", "abbrev": "INSEED", "url": "https://www.inseed.td"},
    "CAF": {"name": "Institut Centrafricain des Statistiques",                   "abbrev": "ICASEES","url": "https://www.icasees.org"},
    "COG": {"name": "Institut National de la Statistique",                       "abbrev": "INS",    "url": "https://ins-congo.cg"},
    "GAB": {"name": "Direction Générale de la Statistique",                      "abbrev": "DGS",    "url": "https://www.dgstat.ga"},
    "GNQ": {"name": "Instituto Nacional de Estadística de Guinea Ecuatorial",    "abbrev": "INEGE",  "url": "https://www.inege.gq"},
    # — Grandes économies —
    "NGA": {"name": "National Bureau of Statistics",                            "abbrev": "NBS",    "url": "https://www.nigerianstat.gov.ng"},
    "ZAF": {"name": "Statistics South Africa",                                  "abbrev": "StatsSA","url": "https://www.statssa.gov.za"},
    "EGY": {"name": "Central Agency for Public Mobilization and Statistics",    "abbrev": "CAPMAS", "url": "https://www.capmas.gov.eg"},
    "MAR": {"name": "Haut-Commissariat au Plan",                               "abbrev": "HCP",    "url": "https://www.hcp.ma"},
    "GHA": {"name": "Ghana Statistical Service",                                "abbrev": "GSS",    "url": "https://www.statsghana.gov.gh"},
    "KEN": {"name": "Kenya National Bureau of Statistics",                      "abbrev": "KNBS",   "url": "https://www.knbs.or.ke"},
    "ETH": {"name": "Ethiopian Statistical Service",                            "abbrev": "ESS",    "url": "https://www.statsethiopia.gov.et"},
    "TZA": {"name": "National Bureau of Statistics",                            "abbrev": "NBS",    "url": "https://www.nbs.go.tz"},
    "UGA": {"name": "Uganda Bureau of Statistics",                              "abbrev": "UBOS",   "url": "https://www.ubos.org"},
    "RWA": {"name": "National Institute of Statistics of Rwanda",               "abbrev": "NISR",   "url": "https://www.statistics.gov.rw"},
    "DZA": {"name": "Office National des Statistiques",                         "abbrev": "ONS",    "url": "https://www.ons.dz"},
    "TUN": {"name": "Institut National de la Statistique",                      "abbrev": "INS",    "url": "https://www.ins.tn"},
    "AGO": {"name": "Instituto Nacional de Estatística",                        "abbrev": "INE",    "url": "https://www.ine.gov.ao"},
    "MOZ": {"name": "Instituto Nacional de Estatística",                        "abbrev": "INE",    "url": "https://www.ine.gov.mz"},
    "ZMB": {"name": "Zambia Statistics Agency",                                 "abbrev": "ZamStats","url": "https://www.zamstats.gov.zm"},
    "ZWE": {"name": "Zimbabwe National Statistics Agency",                      "abbrev": "ZimStat","url": "https://www.zimstat.co.zw"},
    "MUS": {"name": "Statistics Mauritius",                                     "abbrev": "StatsMU","url": "https://statsmauritius.govmu.org"},
    "BWA": {"name": "Statistics Botswana",                                      "abbrev": "StatsBW","url": "https://www.statsbots.org.bw"},
    "NAM": {"name": "Namibia Statistics Agency",                                "abbrev": "NSA",    "url": "https://nsa.org.na"},
    "MWI": {"name": "National Statistical Office",                              "abbrev": "NSO",    "url": "http://www.nsomalawi.mw"},
    "MDG": {"name": "Institut National de la Statistique",                      "abbrev": "INSTAT", "url": "https://www.instat.mg"},
    "GIN": {"name": "Institut National de la Statistique",                      "abbrev": "INS",    "url": "https://www.stat-guinee.org"},
    "SLE": {"name": "Statistics Sierra Leone",                                  "abbrev": "StatsSL","url": "https://www.statistics.sl"},
    "LBR": {"name": "Liberia Institute of Statistics & Geo-Information Services","abbrev": "LISGIS","url": "https://www.lisgis.gov.lr"},
    "GMB": {"name": "Gambia Bureau of Statistics",                              "abbrev": "GBoS",   "url": "https://www.gbosdata.org"},
    "MRT": {"name": "Agence Nationale de la Statistique et de l'Analyse Démographique et Économique", "abbrev": "ANSADE", "url": "https://www.ansade.mr"},
}

# Banque centrale par défaut pour la Mauritanie (hors zones franc)
CENTRAL_BANKS.setdefault("MRT", {"name": "Banque Centrale de Mauritanie", "abbrev": "BCM", "url": "https://www.bcm.mr"})

# ============================================================
# Tags de source considérés « nationaux »
# Sert à filtrer macro_indicators.source dans l'endpoint.
# ============================================================
NATIONAL_SOURCE_TAGS: set[str] = (
    {"BCEAO", "BEAC", "CENTRAL_BANK", "CENTRAL_BANKS"}
    | {cb["abbrev"] for cb in CENTRAL_BANKS.values()}
    | {si["abbrev"] for si in NATIONAL_STATS_INSTITUTES.values()}
)


def _central_bank_for(country_id: str) -> dict:
    """Retourne la banque centrale d'un pays (via zone franc puis mapping)."""
    cid = country_id.upper()
    if cid in UEMOA:
        return BCEAO
    if cid in CEMAC:
        return BEAC
    return CENTRAL_BANKS.get(cid, {})


def get_national_sources(country_id: str) -> dict:
    """
    Catalogue des institutions nationales d'un pays.

    Renvoie `{stats_institute, central_bank, others}`. Les entrées absentes
    valent `None` (institut non curé) afin que le frontend gère l'affichage.
    """
    cid = country_id.upper()
    return {
        "stats_institute": NATIONAL_STATS_INSTITUTES.get(cid),
        "central_bank": _central_bank_for(cid) or None,
        "others": [],
    }
