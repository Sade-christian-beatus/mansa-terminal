#!/usr/bin/env python3
"""
MANSA Terminal — Seed 54 pays africains
Usage depuis Railway Console : python scripts/seed_countries.py
"""
import os, sys

try:
    import psycopg2
except ImportError:
    print("Installing psycopg2..."); os.system("pip install psycopg2-binary -q")
    import psycopg2

url = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL", "")
url = url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")

if not url:
    print("ERROR: DATABASE_URL not set"); sys.exit(1)

COUNTRIES = [
    ("DZA","DZ","Algeria","Algérie","North Africa","DZD",False,False,1,"🇩🇿"),
    ("EGY","EG","Egypt","Égypte","North Africa","EGP",False,False,1,"🇪🇬"),
    ("LBY","LY","Libya","Libye","North Africa","LYD",False,False,2,"🇱🇾"),
    ("MAR","MA","Morocco","Maroc","North Africa","MAD",False,False,1,"🇲🇦"),
    ("SDN","SD","Sudan","Soudan","North Africa","SDG",False,False,2,"🇸🇩"),
    ("TUN","TN","Tunisia","Tunisie","North Africa","TND",False,False,1,"🇹🇳"),
    ("BEN","BJ","Benin","Bénin","West Africa","XOF",True,False,2,"🇧🇯"),
    ("BFA","BF","Burkina Faso","Burkina Faso","West Africa","XOF",True,False,2,"🇧🇫"),
    ("CPV","CV","Cabo Verde","Cap-Vert","West Africa","CVE",False,False,3,"🇨🇻"),
    ("GMB","GM","Gambia","Gambie","West Africa","GMD",False,False,3,"🇬🇲"),
    ("GHA","GH","Ghana","Ghana","West Africa","GHS",False,False,1,"🇬🇭"),
    ("GIN","GN","Guinea","Guinée","West Africa","GNF",False,False,2,"🇬🇳"),
    ("GNB","GW","Guinea-Bissau","Guinée-Bissau","West Africa","XOF",True,False,3,"🇬🇼"),
    ("CIV","CI","Cote dIvoire","Côte d'Ivoire","West Africa","XOF",True,False,1,"🇨🇮"),
    ("LBR","LR","Liberia","Libéria","West Africa","LRD",False,False,3,"🇱🇷"),
    ("MLI","ML","Mali","Mali","West Africa","XOF",True,False,2,"🇲🇱"),
    ("MRT","MR","Mauritania","Mauritanie","West Africa","MRU",False,False,3,"🇲🇷"),
    ("NER","NE","Niger","Niger","West Africa","XOF",True,False,2,"🇳🇪"),
    ("NGA","NG","Nigeria","Nigéria","West Africa","NGN",False,False,1,"🇳🇬"),
    ("SEN","SN","Senegal","Sénégal","West Africa","XOF",True,False,1,"🇸🇳"),
    ("SLE","SL","Sierra Leone","Sierra Leone","West Africa","SLL",False,False,3,"🇸🇱"),
    ("TGO","TG","Togo","Togo","West Africa","XOF",True,False,2,"🇹🇬"),
    ("AGO","AO","Angola","Angola","Central Africa","AOA",False,False,1,"🇦🇴"),
    ("CMR","CM","Cameroon","Cameroun","Central Africa","XAF",False,True,1,"🇨🇲"),
    ("CAF","CF","Central African Rep","Centrafrique","Central Africa","XAF",False,True,3,"🇨🇫"),
    ("TCD","TD","Chad","Tchad","Central Africa","XAF",False,True,2,"🇹🇩"),
    ("COG","CG","Republic of Congo","Congo-Brazzaville","Central Africa","XAF",False,True,2,"🇨🇬"),
    ("COD","CD","DR Congo","RD Congo","Central Africa","CDF",False,False,1,"🇨🇩"),
    ("GNQ","GQ","Equatorial Guinea","Guinée équatoriale","Central Africa","XAF",False,True,2,"🇬🇶"),
    ("GAB","GA","Gabon","Gabon","Central Africa","XAF",False,True,2,"🇬🇦"),
    ("STP","ST","Sao Tome and Principe","São Tomé-et-Príncipe","Central Africa","STN",False,False,3,"🇸🇹"),
    ("BDI","BI","Burundi","Burundi","East Africa","BIF",False,False,3,"🇧🇮"),
    ("COM","KM","Comoros","Comores","East Africa","KMF",False,False,3,"🇰🇲"),
    ("DJI","DJ","Djibouti","Djibouti","East Africa","DJF",False,False,3,"🇩🇯"),
    ("ERI","ER","Eritrea","Érythrée","East Africa","ERN",False,False,3,"🇪🇷"),
    ("ETH","ET","Ethiopia","Éthiopie","East Africa","ETB",False,False,1,"🇪🇹"),
    ("KEN","KE","Kenya","Kenya","East Africa","KES",False,False,1,"🇰🇪"),
    ("MDG","MG","Madagascar","Madagascar","East Africa","MGA",False,False,2,"🇲🇬"),
    ("MWI","MW","Malawi","Malawi","East Africa","MWK",False,False,2,"🇲🇼"),
    ("MUS","MU","Mauritius","Maurice","East Africa","MUR",False,False,1,"🇲🇺"),
    ("MOZ","MZ","Mozambique","Mozambique","East Africa","MZN",False,False,2,"🇲🇿"),
    ("RWA","RW","Rwanda","Rwanda","East Africa","RWF",False,False,1,"🇷🇼"),
    ("SYC","SC","Seychelles","Seychelles","East Africa","SCR",False,False,2,"🇸🇨"),
    ("SOM","SO","Somalia","Somalie","East Africa","SOS",False,False,3,"🇸🇴"),
    ("SSD","SS","South Sudan","Soudan du Sud","East Africa","SSP",False,False,3,"🇸🇸"),
    ("TZA","TZ","Tanzania","Tanzanie","East Africa","TZS",False,False,1,"🇹🇿"),
    ("UGA","UG","Uganda","Ouganda","East Africa","UGX",False,False,1,"🇺🇬"),
    ("ZMB","ZM","Zambia","Zambie","East Africa","ZMW",False,False,1,"🇿🇲"),
    ("ZWE","ZW","Zimbabwe","Zimbabwe","East Africa","ZWL",False,False,2,"🇿🇼"),
    ("BWA","BW","Botswana","Botswana","Southern Africa","BWP",False,False,1,"🇧🇼"),
    ("LSO","LS","Lesotho","Lesotho","Southern Africa","LSL",False,False,3,"🇱🇸"),
    ("NAM","NA","Namibia","Namibie","Southern Africa","NAD",False,False,2,"🇳🇦"),
    ("ZAF","ZA","South Africa","Afrique du Sud","Southern Africa","ZAR",False,False,1,"🇿🇦"),
    ("SWZ","SZ","Eswatini","Eswatini","Southern Africa","SZL",False,False,3,"🇸🇿"),
]

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

inserted = 0
for c in COUNTRIES:
    try:
        cur.execute("""
            INSERT INTO countries(id,iso2,name_en,name_fr,region,currency_code,
                                  is_waemu,is_cemac,coverage_tier,flag_emoji,is_active)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,true)
            ON CONFLICT(id) DO UPDATE SET
                name_en=EXCLUDED.name_en, name_fr=EXCLUDED.name_fr,
                flag_emoji=EXCLUDED.flag_emoji, coverage_tier=EXCLUDED.coverage_tier
        """, c)
        inserted += 1
    except Exception as e:
        print(f"  ERR {c[0]}: {e}")

cur.close()
conn.close()
print(f"\n✅ Done: {inserted}/54 countries seeded!")
