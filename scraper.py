import re
import time
import requests
from datetime import datetime

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# ⬇️ Remets tes vraies valeurs copiées depuis firebase.js
FIREBASE_API_KEY = "AIzaSyDHYMRJpVUXCE5JA7YhODPd45SJQwwWI1Q"
PROJECT_ID = "tesla-tracker-83265"

# --- Sources HTML (phpBB / Invision) ---
HTML_SOURCES = []
for start in range(0, 200, 20):
    HTML_SOURCES.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25525&start={start}")
    HTML_SOURCES.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25522&start={start}")
for page in range(1, 5):
    HTML_SOURCES.append(f"https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/page/{page}/")

# --- Sources Discourse (API JSON officielle) ---
DISCOURSE_SOURCES = [
    "https://community.club-tesla.fr/t/2990.json",
]

ORDER_KW = ["command", "cmde"]
DELIVERY_KW = ["livr", "reçu", "reception"]
DATE_RE = r"\d{1,2}/\d{1,2}(?:/\d{2,4})?"

delays = []
examples = []
seen_pairs = set()
orders_count = 0
deliveries_count = 0
now_year = datetime.now().year

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

def analyze_text(text):
    global orders_count, deliveries_count
    for line in clean_lines(text):
        o = dates_with_context(line, ORDER_KW)
        l = dates_with_context(line, DELIVERY_KW)
        orders_count += len(o)
        deliveries_count += len(l)
        if o and l and o[0] != l[0]:
            key = (o[0], l[0])
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            d1 = parse_date(o[0], now_year)
            d2 = parse_date(l[0], now_year)
            if d1 and d2:
                if (d2 - d1).days < 7:
                    try:
                        d2 = d2.replace(year=d2.year + 1)
                    except ValueError:
                        continue
                days = (d2 - d1).days
                if 10 < days < 200:
                    delays.append(days)
                    if len(examples) < 6:
                        examples.append(f"{o[0]} -> {l[0]} = {days} j")

# --- Lecture des sources HTML ---
for url in HTML_SOURCES:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
    except Exception:
        continue
    if r.status_code == 200:
        analyze_text(r.text)
    time.sleep(0.3)

# --- Lecture des sources Discourse (JSON) ---
for url in DISCOURSE_SOURCES:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        data = r.json()
        for post in data.get("post_stream", {}).get("posts", []):
            analyze_text(post.get("cooked", ""))
    except Exception:
        continue
    time.sleep(0.3)

avg = round(sum(delays) / len(delays)) if delays else 0
print("=== ANALYSE DES DÉLAIS (MULTI-SOURCES) ===")
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