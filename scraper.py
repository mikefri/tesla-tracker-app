import re
import requests

url = "https://www.blogtesla.fr/forum/viewtopic.php?t=25525"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

r = requests.get(url, headers=HEADERS, timeout=30)
html = r.text

def clean(c):
    t = re.sub(r"<[^>]+>", " ", c)
    return re.sub(r"\s+", " ", t)

chunks = re.split(r'class="post', html)[1:]
print("Messages détectés :", len(chunks))

# Aperçu de 3 messages pour voir le vocabulaire réel
for i, c in enumerate(chunks[:3]):
    print(f"\n----- MESSAGE {i+1} -----")
    print(clean(c)[:600])

# Test de plusieurs motifs de recherche
whole = clean(html).lower()
print("\n--- TESTS DE MOTIFS ---")
print("rn+chiffres        :", re.findall(r"rn[\s\-:]*(\d{4,6})", whole)[:5])
print("commande+chiffres  :", re.findall(r"commande[\s\w°:.-]{0,10}(\d{4,6})", whole)[:5])
print("n°+chiffres        :", re.findall(r"n°[\s]*(\d{4,6})", whole)[:5])
print("numero+chiffres    :", re.findall(r"num[\w°]*[\s:.-]{0,3}(\d{4,6})", whole)[:5])
print("VIN 17 caractères  :", re.findall(r"(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])", html)[:5])