import re
import requests
from datetime import datetime

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# ⬇️ Remets tes vraies valeurs depuis firebase.js
FIREBASE_API_KEY = "AIzaSyDHYMRJpVUXCE5JA7YhODPd45SJQwwWI1Q"
PROJECT_ID = "tesla-tracker-83265"



SOURCES = []
for start in range(0, 100, 20):
    SOURCES.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25525&start={start}")
    SOURCES.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25522&start={start}")
SOURCES.append("https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/")

ORDER_KW = ["command", "cmde"]
DELIVERY_KW = ["livr", "reçu", "reception"]
DATE_RE = r"\d{1,2}/\d{1,2}(?:/\d{2,4})?"

def clean_lines(t):
    t = re.sub(r"<[^>]+>", "\n", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.lower().split("\n")

def parse_date(s, base_year):
    parts = s.split("/")
    d, m = int(parts[0]), int(parts[1])
    if len(parts) == 3:
        y = int(parts[2]) if len(parts[2]) == 4 else 2000 + int(parts[2])
    else:
        y = base_year
    try:
        return datetime(y, m, d)
    except ValueError:
        return None

def dates_with_context(line, keywords):
    result = []
    for m in re.finditer(DATE_RE, line):
        before = line[max(0, m.start() - 40):m.start()]
        if "prévu" in before or "prevu" in before or "estim" in before:
            continue
        if any(k in before for k in keywords):
            result.append(m.group(0))
    return result

delays = []
examples = []
orders_count = 0
deliveries_count = 0
now_year = datetime.now().year

for url in SOURCES:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
    except Exception:
        continue
    if r.status_code != 200:
        continue
    for line in clean_lines(r.text):
        o = dates_with_context(line, ORDER_KW)
        l = dates_with_context(line, DELIVERY_KW)
        orders_count += len(o)
        deliveries_count += len(l)
        # Correctif 1 : on ignore si les deux dates sont identiques
        if o and l and o[0] != l[0]:
            d1 = parse_date(o[0], now_year)
            d2 = parse_date(l[0], now_year)
            if d1 and d2:
                if (d2 - d1).days < 7:
                    try:
                        d2 = d2.replace(year=d2.year + 1)
                    except ValueError:
                        continue
                days = (d2 - d1).days
                # Correctif 2 : uniquement les délais réalistes
                if 10 < days < 200:
                    delays.append(days)
                    if len(examples) < 5:
                        examples.append(f"{o[0]} -> {l[0]} = {days} j")

avg = round(sum(delays) / len(delays)) if delays else 0
print("=== ANALYSE DES DÉLAIS ===")
print(f"Paires commande→livraison trouvées : {len(delays)}")
print(f"Délai moyen observé : {avg} jours")
if delays:
    print(f"Min : {min(delays)} j | Max : {max(delays)} j")
print("Exemples :", examples)

url_firestore = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/stats/global?key={FIREBASE_API_KEY}"
payload = {
    "fields": {
        "commandes_count": {"integerValue": str(orders_count)},
        "livraisons_count": {"integerValue": str(deliveries_count)},
        "delai_moyen_jours": {"integerValue": str(avg)},
        "delais_analyses": {"integerValue": str(len(delays))},
        "updated_at": {"stringValue": datetime.now().isoformat()}
    }
}
r = requests.patch(url_firestore, json=payload)
print("Envoi vers Firestore :", r.status_code)