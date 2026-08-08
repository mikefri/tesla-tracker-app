import re
import requests

THREADS = [
    "https://www.blogtesla.fr/forum/viewtopic.php?t=25525",
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TeslaTracker/0.1)"}

def fetch_posts(url):
    html = requests.get(url, headers=HEADERS, timeout=30).text
    chunks = re.split(r'class="post', html)[1:]
    posts = []
    for chunk in chunks:
        text = re.sub(r"<[^>]+>", " ", chunk)
        text = re.sub(r"\s+", " ", text)
        posts.append(text.lower())
    return posts

def detect_status(text):
    if "livré" in text or "livree" in text:
        return "LIVREE"
    if "bateau" in text or "navire" in text or "cargo" in text:
        return "TRANSPORT"
    if "vin" in text or "production" in text or "usine" in text:
        return "PRODUCTION"
    return "COMMANDE"

def main():
    found = {}
    order = ["COMMANDE", "PRODUCTION", "TRANSPORT", "LIVREE"]
    for url in THREADS:
        try:
            posts = fetch_posts(url)
        except Exception as e:
            print("Erreur sur", url, ":", e)
            continue
        for text in posts:
            for rn in re.findall(r"rn[\s\-:]*(\d{4,6})", text):
                status = detect_status(text)
                if rn not in found or order.index(status) > order.index(found[rn]):
                    found[rn] = status
    if not found:
        print("Aucun RN détecté sur cette page.")
    for rn, status in sorted(found.items()):
        print(f"RN{rn} -> {status}")

if __name__ == "__main__":
    main()