import re
import time
import requests
from datetime import datetime

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# ⬇️ Remets tes vraies valeurs copiées depuis firebase.js
FIREBASE_API_KEY = "AIzaSyDHYMRJpVUXCE5JA7YhODPd45SJQwwWI1Q"
PROJECT_ID = "tesla-tracker-83265"

# ---------- Sources HTML ----------
FR_HTML = []
for start in range(0, 200, 20):
    FR_HTML.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25525&start={start}")
    FR_HTML.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25522&start={start}")
FR_HTML.append("https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/")
for page in range(2, 5):
    FR_HTML.append(f"https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/?page={page}")

SOURCES = [(u, "html", "fr") for u in FR_HTML]
SOURCES.append(("https://community.club-tesla.fr/t/2990.json", "discourse", "fr"))
SOURCES.append(("https://teslamotorsclub.com/tmc/threads/tesla-shipping-movements.319517/", "html", "en"))

# ---------- Vocabulaire et formats de dates ----------
LANGS = {
    "fr": {"order": ["command", "cmde"], "deliv": ["livr", "reçu", "reception"],
           "exclude": ["prévu", "prevu", "estim"], "mode": "dm"},
    "en": {"order": ["ordered"], "deliv": ["delivered", "picked up"],
           "exclude": ["expected", "estimated", "scheduled"], "mode": "md"},
    "de": {"order": ["bestellt"], "deliv": ["geliefert", "ausgeliefert"],
           "exclude": ["geplant", "erwartet", "voraussichtlich"], "mode": "dot"},
}

DATE_RES = {
    "dm": r"(?<!\d)\d{1,2}/\d{1,2}(?:/\d{2,4})?(?!\d)",
    "md": r"(?<!\d)\d{1,2}/\d{1,2}(?:/\d{2,4})?(?!\d)",
    "dot": r"(?<!\d)\d{1,2}\.\d{1,2}(?:\.\d{2,4})?(?!\d)",
}

delays = {"fr": [], "en": [], "de": []}
examples = []
seen_pairs = set()
orders_count = 0
deliveries_count = 0
now_year = datetime.now().year

def clean_lines(t):
    t = re.sub(r"<[^>]+>", "\n", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.lower().split("\n")

def parse_date(s, base_year, mode):
    sep = "." if mode == "dot" else "/"
    parts = s.split(sep)
    if mode == "md":
        m, d = int(parts[0]), int(parts[1])
    else:
        d, m = int(parts[0]), int(parts[1])
    if len(parts) == 3:
        y = int(parts[2]) if len(parts[2]) == 4 else 2000 + int(parts[2])
    else:
        y = base_year
    try:
        return datetime(y, m, d)
    except ValueError:
        return None

def dates_with_context(line, keywords, excludes, date_re):
    result = []
    for m in re.finditer(date_re, line):
        before = line[max(0, m.start() - 40):m.start()]
        if any(x in before for x in excludes):
            continue
        if any(k in before for k in keywords):
            result.append(m.group(0))
    return result

def analyze_text(text, lang):
    global orders_count, deliveries_count
    cfg = LANGS[lang]
    date_re = DATE_RES[cfg["mode"]]
    for line in clean_lines(text):
        o = dates_with_context(line, cfg["order"], cfg["exclude"], date_re)
        l = dates_with_context(line, cfg["deliv"], cfg["exclude"], date_re)
        orders_count += len(o)
        deliveries_count += len(l)
        if o and l and o[0] != l[0]:
            key = (lang, o[0], l[0])
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            d1 = parse_date(o[0], now_year, cfg["mode"])
            d2 = parse_date(l[0], now_year, cfg["mode"])
            if d1 and d2:
                if (d2 - d1).days < 7:
                    try:
                        d2 = d2.replace(year=d2.year + 1)
                    except ValueError:
                        continue
                days = (d2 - d1).days
                if 10 < days < 200:
                    delays[lang].append(days)
                    if len(examples) < 8:
                        examples.append(f"[{lang}] {o[0]} -> {l[0]} = {days} j")

# ---------- Lecture des sources ----------
for url, kind, lang in SOURCES:
    total_before = sum(len(v) for v in delays.values())
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
    except Exception:
        continue
    if r.status_code != 200:
        print(f"[{lang}] HTTP {r.status_code}")
        continue
    if kind == "html":
        analyze_text(r.text, lang)
    elif kind == "discourse":
        try:
            data = r.json()
            for post in data.get("post_stream", {}).get("posts", []):
                analyze_text(post.get("cooked", ""), lang)
        except Exception:
            pass
    total_after = sum(len(v) for v in delays.values())
    if total_after > total_before:
        print(f"[{lang}] +{total_after - total_before} paires")
    time.sleep(0.5)

# ---------- Discourse FR : chasse aux sujets de livraison ----------
try:
    r = requests.get("https://community.club-tesla.fr/search.json?q=livr%C3%A9", headers=HEADERS, timeout=30)
    topics = r.json().get("topics", [])
    ids = [t.get("id") for t in topics if t.get("id")][:8]
    print(f"[fr] {len(ids)} sujets Discourse trouvés par la recherche")
    for tid in ids:
        try:
            rt = requests.get(f"https://community.club-tesla.fr/t/{tid}.json", headers=HEADERS, timeout=30)
            data = rt.json()
            for post in data.get("post_stream", {}).get("posts", []):
                analyze_text(post.get("cooked", ""), "fr")
        except Exception:
            continue
        time.sleep(0.5)
except Exception as e:
    print("[fr] recherche Discourse impossible :", e)

all_delays = delays["fr"] + delays["en"] + delays["de"]
avg = round(sum(all_delays) / len(all_delays)) if all_delays else 0
print("=== ANALYSE MULTI-LANGUES ===")
print(f"FR : {len(delays['fr'])} | EN : {len(delays['en'])} | DE : {len(delays['de'])}")
print(f"TOTAL : {len(all_delays)} paires")
print(f"Délai moyen global : {avg} jours")
if all_delays:
    print(f"Min : {min(all_delays)} j | Max : {max(all_delays)} j")
print("Exemples :", examples)

url_firestore = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/stats/global?key={FIREBASE_API_KEY}"
payload = {
    "fields": {
        "commandes_count": {"integerValue": str(orders_count)},
        "livraisons_count": {"integerValue": str(deliveries_count)},
        "delai_moyen_jours": {"integerValue": str(avg)},
        "delais_analyses": {"integerValue": str(len(all_delays))},
        "paires_fr": {"integerValue": str(len(delays['fr']))},
        "paires_en": {"integerValue": str(len(delays['en']))},
        "paires_de": {"integerValue": str(len(delays['de']))},
        "updated_at": {"stringValue": datetime.now().isoformat()}
    }
}
r = requests.patch(url_firestore, json=payload)
print("Envoi vers Firestore :", r.status_code)