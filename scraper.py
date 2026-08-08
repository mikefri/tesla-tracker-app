import re
import requests

THREADS = [
    "https://www.blogtesla.fr/forum/viewtopic.php?t=25525",
    "https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
}

def clean(html_chunk):
    text = re.sub(r"<[^>]+>", " ", html_chunk)
    text = re.sub(r"\s+", " ", text)
    return text

def detect_status(text):
    if "livré" in text or "livree" in text:
        return "LIVREE"
    if "bateau" in text or "navire" in text or "cargo" in text or "transport" in text:
        return "TRANSPORT"
    if "vin" in text or "production" in text or "usine" in text:
        return "PRODUCTION"
    return "COMMANDE"

def main():
    order = ["COMMANDE", "PRODUCTION", "TRANSPORT", "LIVREE"]
    found = {}
    for url in THREADS:
        print("\n=== Analyse :", url)
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
        except Exception as e:
            print("Erreur réseau :", e)
            continue
        print("Statut HTTP :", r.status_code, "| Taille de la page :", len(r.text), "caractères")
        chunks = re.split(r'class="post', r.text)[1:]
        print("Nombre de messages détectés :", len(chunks))
        whole = clean(r.text).lower()
        print("RN trouvés dans toute la page :", re.findall(r"rn[\s\-:]*(\d{4,6})", whole)[:10])
        for chunk in chunks:
            text = clean(chunk).lower()
            for rn in re.findall(r"rn[\s\-:]*(\d{4,6})", text):
                status = detect_status(text)
                if rn not in found or order.index(status) > order.index(found[rn]):
                    found[rn] = status
    print("\n=== RÉSULTAT FINAL ===")
    if not found:
        print("Aucun RN détecté.")
    for rn, status in sorted(found.items()):
        print(f"RN{rn} -> {status}")

if __name__ == "__main__":
    main()