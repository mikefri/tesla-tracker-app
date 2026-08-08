import re
import requests

url = "https://www.blogtesla.fr/forum/viewtopic.php?t=25525"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

r = requests.get(url, headers=HEADERS, timeout=30)

def clean(t):
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t)

whole = clean(r.text).lower()

print("Occurrences 'commandé'  :", whole.count("commandé"))
print("Occurrences 'livré'     :", whole.count("livré"))
print("Occurrences 'production':", whole.count("production"))
print("Occurrences 'bateau'    :", whole.count("bateau"))

print("\nDates après 'commandé le' :", re.findall(r"commandé le ([\d/]+)", whole)[:10])
print("Dates après 'livré le'    :", re.findall(r"livré le ([\d/]+)", whole)[:10])

chunks = re.split(r'class="post', r.text)[1:]
shown = 0
for c in chunks:
    t = clean(c).lower()
    if "livré" in t and shown < 2:
        print("\n----- MESSAGE AVEC 'LIVRÉ' -----")
        print(t[:500])
        shown += 1