import re
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# Plusieurs pages des 2 gros sujets de suivi de commandes
SOURCES = []
for start in range(0, 100, 20):
    SOURCES.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25525&start={start}")
    SOURCES.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25522&start={start}")
SOURCES.append("https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/")

def clean(t):
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t)

ORDER_KW = ["command", "cmde"]
DELIVERY_KW = ["livr", "reçu", "reception"]

orders = []
deliveries = []

for url in SOURCES:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
    except Exception as e:
        print("Erreur:", url, e)
        continue
    if r.status_code != 200:
        continue
    text = clean(r.text).lower()
    for m in re.finditer(r"\d{1,2}/\d{1,2}(?:/\d{2,4})?", text):
        date = m.group(0)
        before = text[max(0, m.start() - 40):m.start()]
        if any(k in before for k in DELIVERY_KW):
            deliveries.append(date)
        elif any(k in before for k in ORDER_KW):
            orders.append(date)

print("=== STATISTIQUES COMMUNAUTÉ ===")
print(f"Commandes datées trouvées : {len(orders)}")
print(f"Livraisons datées trouvées : {len(deliveries)}")
print("\nDernières commandes :", orders[-15:])
print("Dernières livraisons :", deliveries[-15:])