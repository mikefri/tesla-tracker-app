import re
import time
import requests
from datetime import datetime, timedelta

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

delays = {"fr": [], "en": [], "de": [], "app": []}
pairs = []
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
                    pairs.append((d1, days))
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
    time.sleep(0.3)

# ---------- Discourse FR : chasse aux sujets ----------
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
        time.sleep(0.3)
except Exception as e:
    print("[fr] recherche Discourse impossible :", e)

# ---------- Rapports utilisateurs (flywheel) ----------
try:
    url_rap = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/rapports?key={FIREBASE_API_KEY}&pageSize=100"
    rr = requests.get(url_rap, headers=HEADERS, timeout=30)
    docs = rr.json().get("documents", [])
    added = 0
    for docu in docs:
        f = docu.get("fields", {})
        dj = f.get("delai_jours", {}).get("integerValue")
        dc = f.get("date_commande", {}).get("stringValue", "")
        if dj:
            delays["app"].append(int(dj))
            added += 1
            d1 = parse_date(dc, now_year, "dm")
            if d1:
                pairs.append((d1, int(dj)))
    print(f"[app] {added} rapport(s) utilisateur(s) intégré(s)")
except Exception as e:
    print("[app] lecture rapports impossible :", e)

# ---------- Statistiques globales + cohortes ----------
all_delays = sum(delays.values(), [])
avg = round(sum(all_delays) / len(all_delays)) if all_delays else 0
sorted_delays = sorted(all_delays)
n = len(sorted_delays)
if n:
    d_min = sorted_delays[0]
    d_max = sorted_delays[-1]
    d_med = sorted_delays[n // 2] if n % 2 == 1 else (sorted_delays[n // 2 - 1] + sorted_delays[n // 2]) // 2
else:
    d_min = d_max = d_med = 0

cohortes = {}
for d1, days in pairs:
    key = f"{d1.year}-{d1.month:02d}"
    cohortes.setdefault(key, []).append(days)
cohort_avg = {k: round(sum(v) / len(v)) for k, v in sorted(cohortes.items())}

print("=== ANALYSE MULTI-SOURCES ===")
print(f"FR : {len(delays['fr'])} | EN : {len(delays['en'])} | DE : {len(delays['de'])} | APP : {len(delays['app'])}")
print(f"TOTAL : {n} paires | Moyenne : {avg} j | Médiane : {d_med} j | Min : {d_min} j | Max : {d_max} j")
print("Cohortes (mois de commande -> délai moyen) :", cohort_avg)
print("Exemples :", examples)

# ---------- NOTIFICATIONS PUSH VERS LES ABONNÉS ----------
def parse_fr(s):
    try:
        p = s.strip().split("/")
        return datetime(int(p[2]), int(p[1]), int(p[0]))
    except Exception:
        return None

try:
    url_abo = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/abonnes?key={FIREBASE_API_KEY}&pageSize=100"
    rr = requests.get(url_abo, headers=HEADERS, timeout=30)
    docs = rr.json().get("documents", [])
    print(f"[push] {len(docs)} abonné(s) vérifié(s)")
    for docu in docs:
        f = docu.get("fields", {})
        token = f.get("token", {}).get("stringValue")
        dc = f.get("date_commande", {}).get("stringValue", "")
        doc_id = docu.get("name", "").split("/")[-1]
        d1 = parse_fr(dc)
        if not token or not d1 or not avg:
            continue
        est = d1 + timedelta(days=avg)
        days_left = (est - datetime.now()).days
        if -7 <= days_left <= 7:
            body = f"🚗 Ta Model Y approche ! Livraison estimée autour du {est.strftime('%d/%m/%Y')}."
        else:
            last = f.get("last_notif_at", {}).get("stringValue", "")
            if last:
                try:
                    if (datetime.now() - datetime.fromisoformat(last)).days < 7:
                        continue
                except ValueError:
                    pass
            body = f"📊 Suivi Tesla Tracker : livraison estimée autour du {est.strftime('%d/%m/%Y')} (moyenne communauté : {avg} j)."
        rp = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=[{"to": token, "sound": "default", "title": "⚡ Tesla Tracker", "body": body}],
            timeout=30,
        )
        print(f"[push] envoi : {rp.status_code}")
        patch_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/abonnes/{doc_id}?key={FIREBASE_API_KEY}&updateMask.fieldPaths=last_notif_at"
        requests.patch(patch_url, json={"fields": {"last_notif_at": {"stringValue": datetime.now().isoformat()}}}, timeout=30)
except Exception as e:
    print("[push] erreur notifications :", e)

# ---------- Envoi des stats vers Firestore ----------
url_firestore = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/stats/global?key={FIREBASE_API_KEY}"
payload = {
    "fields": {
        "commandes_count": {"integerValue": str(orders_count)},
        "livraisons_count": {"integerValue": str(deliveries_count)},
        "delai_moyen_jours": {"integerValue": str(avg)},
        "delais_analyses": {"integerValue": str(n)},
        "delai_min": {"integerValue": str(d_min)},
        "delai_max": {"integerValue": str(d_max)},
        "delai_mediane": {"integerValue": str(d_med)},
        "cohortes": {"mapValue": {"fields": {k: {"integerValue": str(v)} for k, v in cohort_avg.items()}}},
        "paires_fr": {"integerValue": str(len(delays['fr']))},
        "paires_en": {"integerValue": str(len(delays['en']))},
        "paires_de": {"integerValue": str(len(delays['de']))},
        "paires_app": {"integerValue": str(len(delays['app']))},
        "updated_at": {"stringValue": datetime.now().isoformat()}
    }
}
r = requests.patch(url_firestore, json=payload)
print("Envoi vers Firestore :", r.status_code)