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
DATE_RE = r"\d{1,2}/\d{1,2}/\d{2,4}"

def clean_lines(t):
    t = re.sub(r"<[^>]+>", "\n", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.lower().split("\n")

def parse_date(s):
    d, m, y = s.split("/")
    y = int(y) if len(y) == 4 else 2000 + int(y)
    try:
        return datetime(y, int(m), int(d))
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
orders_count = 0
deliveries_count = 0

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
        if o and l:
            d1 = parse_date(o[0])
            d2 = parse_date(l[0])
            if d1 and d2:
                days = (d2 - d1).days
                if 7 < days < 400:
                    delays.append(days)

avg = round(sum(delays) / len(delays)) if delays else 0
print("=== ANALYSE DES DÉLAIS ===")
print(f"Paires commande→livraison trouvées : {len(delays)}")
print(f"Délai moyen observé : {avg} jours")
if delays:
    print(f"Min : {min(delays)} j | Max : {max(delays)} j")

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