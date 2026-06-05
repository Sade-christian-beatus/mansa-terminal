#!/usr/bin/env python3
"""
MANSA Terminal — Seed script pour la table `countries`
Insère les 54 pays africains reconnus par l'Union Africaine.

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/seed_countries.py
    python scripts/seed_countries.py --dry-run

Sources : ISO 3166-1, UA, UEMOA, CEMAC, Banque Mondiale
"""
import argparse
import os
import sys

# ── Données des 54 pays africains ─────────────────────────────────────────
# (iso3, iso2, name_en, name_fr, region, sub_region, capital,
#  currency_code, currency_name, is_waemu, is_cemac, coverage_tier, flag_emoji)

COUNTRIES = [
    # Afrique du Nord
    ("DZA","DZ","Algeria","Algérie","North Africa","Maghreb","Algiers","DZD","Dinar algérien",False,False,1,"🇩🇿"),
    ("EGY","EG","Egypt","Égypte","North Africa","Nile Valley","Cairo","EGP","Livre égyptienne",False,False,1,"🇪🇬"),
    ("LBY","LY","Libya","Libye","North Africa","Maghreb","Tripoli","LYD","Dinar libyen",False,False,2,"🇱🇾"),
    ("MAR","MA","Morocco","Maroc","North Africa","Maghreb","Rabat","MAD","Dirham marocain",False,False,1,"🇲🇦"),
    ("SDN","SD","Sudan","Soudan","North Africa","Nile Valley","Khartoum","SDG","Livre soudanaise",False,False,2,"🇸🇩"),
    ("TUN","TN","Tunisia","Tunisie","North Africa","Maghreb","Tunis","TND","Dinar tunisien",False,False,1,"🇹🇳"),
    # Afrique de l'Ouest
    ("BEN","BJ","Benin","Bénin","West Africa","WAEMU","Porto-Novo","XOF","Franc CFA",True,False,2,"🇧🇯"),
    ("BFA","BF","Burkina Faso","Burkina Faso","West Africa","WAEMU","Ouagadougou","XOF","Franc CFA",True,False,2,"🇧🇫"),
    ("CPV","CV","Cape Verde","Cap-Vert","West Africa","ECOWAS","Praia","CVE","Escudo cap-verdien",False,False,3,"🇨🇻"),
    ("CIV","CI","Côte d'Ivoire","Côte d'Ivoire","West Africa","WAEMU","Yamoussoukro","XOF","Franc CFA",True,False,1,"🇨🇮"),
    ("GMB","GM","Gambia","Gambie","West Africa","ECOWAS","Banjul","GMD","Dalasi",False,False,3,"🇬🇲"),
    ("GHA","GH","Ghana","Ghana","West Africa","ECOWAS","Accra","GHS","Cédi",False,False,1,"🇬🇭"),
    ("GIN","GN","Guinea","Guinée","West Africa","ECOWAS","Conakry","GNF","Franc guinéen",False,False,3,"🇬🇳"),
    ("GNB","GW","Guinea-Bissau","Guinée-Bissau","West Africa","WAEMU","Bissau","XOF","Franc CFA",True,False,3,"🇬🇼"),
    ("LBR","LR","Liberia","Libéria","West Africa","ECOWAS","Monrovia","LRD","Dollar libérien",False,False,3,"🇱🇷"),
    ("MLI","ML","Mali","Mali","West Africa","WAEMU","Bamako","XOF","Franc CFA",True,False,2,"🇲🇱"),
    ("MRT","MR","Mauritania","Mauritanie","West Africa","ECOWAS","Nouakchott","MRU","Ouguiya",False,False,3,"🇲🇷"),
    ("NER","NE","Niger","Niger","West Africa","WAEMU","Niamey","XOF","Franc CFA",True,False,2,"🇳🇪"),
    ("NGA","NG","Nigeria","Nigéria","West Africa","ECOWAS","Abuja","NGN","Naira",False,False,1,"🇳🇬"),
    ("SEN","SN","Senegal","Sénégal","West Africa","WAEMU","Dakar","XOF","Franc CFA",True,False,1,"🇸🇳"),
    ("SLE","SL","Sierra Leone","Sierra Leone","West Africa","ECOWAS","Freetown","SLL","Leone",False,False,3,"🇸🇱"),
    ("TGO","TG","Togo","Togo","West Africa","WAEMU","Lomé","XOF","Franc CFA",True,False,2,"🇹🇬"),
    # Afrique centrale
    ("AGO","AO","Angola","Angola","Central Africa","SADC","Luanda","AOA","Kwanza",False,False,1,"🇦🇴"),
    ("BDI","BI","Burundi","Burundi","Central Africa","EAC","Gitega","BIF","Franc burundais",False,False,3,"🇧🇮"),
    ("CAF","CF","Central African Republic","Rép. Centrafricaine","Central Africa","CEMAC","Bangui","XAF","Franc CFA",False,True,3,"🇨🇫"),
    ("CMR","CM","Cameroon","Cameroun","Central Africa","CEMAC","Yaoundé","XAF","Franc CFA",False,True,1,"🇨🇲"),
    ("COD","CD","DR Congo","Rép. Dém. du Congo","Central Africa","SADC","Kinshasa","CDF","Franc congolais",False,False,2,"🇨🇩"),
    ("COG","CG","Republic of Congo","Congo","Central Africa","CEMAC","Brazzaville","XAF","Franc CFA",False,True,2,"🇨🇬"),
    ("GAB","GA","Gabon","Gabon","Central Africa","CEMAC","Libreville","XAF","Franc CFA",False,True,2,"🇬🇦"),
    ("GNQ","GQ","Equatorial Guinea","Guinée équatoriale","Central Africa","CEMAC","Malabo","XAF","Franc CFA",False,True,3,"🇬🇶"),
    ("RWA","RW","Rwanda","Rwanda","Central Africa","EAC","Kigali","RWF","Franc rwandais",False,False,1,"🇷🇼"),
    ("STP","ST","São Tomé and Príncipe","São Tomé-et-Príncipe","Central Africa","ECCAS","São Tomé","STN","Dobra",False,False,3,"🇸🇹"),
    ("TCD","TD","Chad","Tchad","Central Africa","CEMAC","N'Djamena","XAF","Franc CFA",False,True,2,"🇹🇩"),
    # Afrique de l'Est
    ("COM","KM","Comoros","Comores","East Africa","IOC","Moroni","KMF","Franc comorien",False,False,3,"🇰🇲"),
    ("DJI","DJ","Djibouti","Djibouti","East Africa","IGAD","Djibouti","DJF","Franc djiboutien",False,False,3,"🇩🇯"),
    ("ERI","ER","Eritrea","Érythrée","East Africa","IGAD","Asmara","ERN","Nakfa",False,False,3,"🇪🇷"),
    ("ETH","ET","Ethiopia","Éthiopie","East Africa","IGAD","Addis Ababa","ETB","Birr",False,False,1,"🇪🇹"),
    ("KEN","KE","Kenya","Kenya","East Africa","EAC","Nairobi","KES","Shilling kenyan",False,False,1,"🇰🇪"),
    ("MDG","MG","Madagascar","Madagascar","East Africa","IOC","Antananarivo","MGA","Ariary",False,False,3,"🇲🇬"),
    ("MUS","MU","Mauritius","Maurice","East Africa","IOC","Port Louis","MUR","Roupie mauricienne",False,False,1,"🇲🇺"),
    ("MOZ","MZ","Mozambique","Mozambique","East Africa","SADC","Maputo","MZN","Metical",False,False,2,"🇲🇿"),
    ("SOM","SO","Somalia","Somalie","East Africa","IGAD","Mogadishu","SOS","Shilling somalien",False,False,3,"🇸🇴"),
    ("SSD","SS","South Sudan","Soudan du Sud","East Africa","IGAD","Juba","SSP","Livre sud-soudanaise",False,False,3,"🇸🇸"),
    ("TZA","TZ","Tanzania","Tanzanie","East Africa","EAC","Dodoma","TZS","Shilling tanzanien",False,False,1,"🇹🇿"),
    ("UGA","UG","Uganda","Ouganda","East Africa","EAC","Kampala","UGX","Shilling ougandais",False,False,1,"🇺🇬"),
    # Afrique australe
    ("BWA","BW","Botswana","Botswana","Southern Africa","SADC","Gaborone","BWP","Pula",False,False,1,"🇧🇼"),
    ("LSO","LS","Lesotho","Lesotho","Southern Africa","SADC","Maseru","LSL","Loti",False,False,3,"🇱🇸"),
    ("MWI","MW","Malawi","Malawi","Southern Africa","SADC","Lilongwe","MWK","Kwacha malawien",False,False,3,"🇲🇼"),
    ("NAM","NA","Namibia","Namibie","Southern Africa","SADC","Windhoek","NAD","Dollar namibien",False,False,2,"🇳🇦"),
    ("ZAF","ZA","South Africa","Afrique du Sud","Southern Africa","SADC","Pretoria","ZAR","Rand",False,False,1,"🇿🇦"),
    ("SWZ","SZ","Eswatini","Eswatini","Southern Africa","SADC","Mbabane","SZL","Lilangeni",False,False,3,"🇸🇿"),
    ("ZMB","ZM","Zambia","Zambie","Southern Africa","SADC","Lusaka","ZMW","Kwacha zambien",False,False,2,"🇿🇲"),
    ("ZWE","ZW","Zimbabwe","Zimbabwe","Southern Africa","SADC","Harare","ZWL","Dollar zimbabwéen",False,False,2,"🇿🇼"),
]

UPSERT_SQL = """
INSERT INTO countries
    (id, iso2, name_en, name_fr, region, sub_region, capital,
     currency_code, currency_name, is_waemu, is_cemac,
     coverage_tier, flag_emoji, is_active)
VALUES
    (%(id)s, %(iso2)s, %(name_en)s, %(name_fr)s, %(region)s, %(sub_region)s, %(capital)s,
     %(currency_code)s, %(currency_name)s, %(is_waemu)s, %(is_cemac)s,
     %(coverage_tier)s, %(flag_emoji)s, true)
ON CONFLICT (id) DO UPDATE SET
    name_en       = EXCLUDED.name_en,
    name_fr       = EXCLUDED.name_fr,
    region        = EXCLUDED.region,
    sub_region    = EXCLUDED.sub_region,
    capital       = EXCLUDED.capital,
    currency_code = EXCLUDED.currency_code,
    currency_name = EXCLUDED.currency_name,
    is_waemu      = EXCLUDED.is_waemu,
    is_cemac      = EXCLUDED.is_cemac,
    coverage_tier = EXCLUDED.coverage_tier,
    flag_emoji    = EXCLUDED.flag_emoji,
    is_active     = true
"""


def run(dry_run: bool = False) -> None:
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    log = logging.getLogger("seed_countries")

    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url:
        log.error("DATABASE_URL_SYNC non définie — arrêt")
        sys.exit(1)

    rows = [
        {
            "id": r[0], "iso2": r[1], "name_en": r[2], "name_fr": r[3],
            "region": r[4], "sub_region": r[5], "capital": r[6],
            "currency_code": r[7], "currency_name": r[8],
            "is_waemu": r[9], "is_cemac": r[10],
            "coverage_tier": r[11], "flag_emoji": r[12],
        }
        for r in COUNTRIES
    ]

    if dry_run:
        log.info("DRY-RUN — %d pays seraient insérés (aucune écriture DB)", len(rows))
        for r in rows:
            print(f"  {r['id']} | {r['name_en']:30s} | {r['region']}")
        return

    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.executemany(UPSERT_SQL, rows)
        conn.commit()
        log.info("✅ %d pays insérés/mis à jour", len(rows))
    except Exception as exc:
        conn.rollback()
        log.error("Erreur DB : %s", exc)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — Seed table countries")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
