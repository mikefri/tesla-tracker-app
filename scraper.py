"""
Tesla Tracker Scraper
=====================
Scrape les forums européens Tesla pour calculer les délais de livraison moyens.
Utilise Firebase Admin SDK pour une sécurité optimale.

Configuration :
- GitHub Actions : utilise le Secret FIREBASE_SERVICE_ACCOUNT (JSON)
- Local : utilise le fichier serviceAccountKey.json

Dépendances : pip install firebase-admin requests cloudscraper
"""

import os
import re
import sys
import json
import time
import logging
import requests
import cloudscraper
from datetime import datetime, timedelta

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, firestore

# ---------- Configuration du logging ----------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('tesla-scraper')

# ---------- Initialisation Firebase Admin SDK ----------
def init_firebase():
    """Initialise Firebase Admin SDK depuis variable d'environnement ou fichier local."""
    if firebase_admin._apps:
        return firestore.client()
    
    # Option 1 : GitHub Actions (variable d'environnement)
    service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    
    if service_account_json:
        log.info("🔐 Initialisation Firebase depuis variable d'environnement")
        try:
            cred = credentials.Certificate(json.loads(service_account_json))
        except json.JSONDecodeError as e:
            log.error(f"❌ JSON invalide dans FIREBASE_SERVICE_ACCOUNT : {e}")
            sys.exit(1)
    # Option 2 : Fichier local (développement)
    elif os.path.exists('serviceAccountKey.json'):
        log.info("🔐 Initialisation Firebase depuis fichier local")
        cred = credentials.Certificate('serviceAccountKey.json')
    else:
        log.error("❌ Aucune source Firebase trouvée !")
        log.error("   - GitHub Actions : Ajoutez le Secret FIREBASE_SERVICE_ACCOUNT")
        log.error("   - Local : Placez serviceAccountKey.json à la racine")
        sys.exit(1)
    
    firebase_admin.initialize_app(cred)
    return firestore.client()

# ---------- Headers HTTP ----------
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
}

# ---------- Sources à scraper ----------
def build_sources():
    """Construit la liste de toutes les URLs à scraper."""
    # 🇫🇷 France - BlogTesla
    fr_html = []
    for start in range(0, 200, 20):
        fr_html.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25525&start={start}")
        fr_html.append(f"https://www.blogtesla.fr/forum/viewtopic.php?t=25522&start={start}")
    fr_html.append("https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/")
    for page in range(2, 5):
        fr_html.append(f"https://forums.automobile-propre.com/topic/suivi-des-commandes-et-des-livraisons-de-la-tesla-model-y-avec-des-morceaux-collector-22418/?page={page}")
    
    # 🇩🇪 Allemagne - TFF Forum
    de_html = [
        "https://tff-forum.de/t/das-neue-model-y-bestellungen-und-auslieferungen-2025-teil-1/376767",
        "https://tff-forum.de/t/das-neue-model-y-bestellungen-und-auslieferungen-2025-teil-2/394777",
        "https://tff-forum.de/t/das-neue-model-y-bestellungen-und-auslieferungen-2025-teil-3/401521",
        "https://tff-forum.de/t/model-y-juniper-bestellungen-und-auslieferungen-2026-teil-2/410337",
        "https://tff-forum.de/t/model-y-juniper-bestellungen-und-auslieferungen-2026-teil-3/413431",
    ]
    
    # 🇳🇱 Pays-Bas - Tweakers
    nl_html = [f"https://gathering.tweakers.net/forum/list_messages/2222010/{p}" for p in range(0, 100, 20)]
    
    # 🇬🇧 UK
    en_html = ["https://teslamotorsclub.com/tmc/threads/tesla-shipping-movements.319517/"]
    
    # Sources normales (requests)
    sources_normal = [(u, "html", "fr") for u in fr_html]
    sources_normal += [(u, "html", "en") for u in en_html]
    sources_normal += [("https://community.club-tesla.fr/t/2990.json", "discourse", "fr")]
    
    # Sources avec protection Cloudflare
    sources_cloudflare = [(u, "html", "de") for u in de_html]
    sources_cloudflare += [(u, "html", "nl") for u in nl_html]
    
    return sources_normal, sources_cloudflare

# ---------- Vocabulaire et formats de dates ----------
LANGS = {
    "fr": {
        "order": ["command", "cmde", "commandé"],
        "deliv": ["livr", "reçu", "reception", "livré"],
        "exclude": ["prévu", "prevu", "estim"],
        "mode": "dm"  # jour/mois
    },
    "en": {
        "order": ["ordered", "placed order"],
        "deliv": ["delivered", "picked up", "received"],
        "exclude": ["expected", "estimated", "scheduled"],
        "mode": "md"  # mois/jour
    },
    "de": {
        "order": ["bestellt", "bestellung"],
        "deliv": ["geliefert", "ausgeliefert", "erhalten"],
        "exclude": ["geplant", "erwartet", "voraussichtlich"],
        "mode": "dot"  # jour.mois
    },
    "nl": {
        "order": ["besteld", "bestelling"],
        "deliv": ["geleverd", "ontvangen"],
        "exclude": ["verwacht", "geschat"],
        "mode": "dm"
    },
}

DATE_RES = {
    "dm": r"(?<!\d)\d{1,2}/\d{1,2}(?:/\d{2,4})?(?!\d)",
    "md": r"(?<!\d)\d{1,2}/\d{1,2}(?:/\d{2,4})?(?!\d)",
    "dot": r"(?<!\d)\d{1,2}\.\d{1,2}(?:\.\d{2,4})?(?!\d)",
}

# ---------- Structures de données ----------
class ScraperData:
    """Conteneur pour les données collectées."""
    def __init__(self):
        self.delays = {"fr": [], "en": [], "de": [], "nl": [], "app": []}
        self.pairs = []  # (date_commande, délai_jours)
        self.examples = []
        self.seen_pairs = set()
        self.orders_count = 0
        self.deliveries_count = 0
        self.now_year = datetime.now().year

# ---------- Fonctions de parsing ----------
def clean_lines(text):
    """Nettoie le texte HTML et le découpe en lignes."""
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.lower().split("\n")

def parse_date(s, base_year, mode):
    """Parse une date selon le format spécifié."""
    sep = "." if mode == "dot" else "/"
    parts = s.split(sep)
    
    if len(parts) < 2:
        return None
    
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
    """Extrait les dates précédées de mots-clés spécifiques."""
    result = []
    for m in re.finditer(date_re, line):
        before = line[max(0, m.start() - 40):m.start()]
        if any(x in before for x in excludes):
            continue
        if any(k in before for k in keywords):
            result.append(m.group(0))
    return result

def analyze_text(text, lang, data):
    """Analyse un texte pour extraire les paires commande/livraison."""
    if lang not in LANGS:
        return
    
    cfg = LANGS[lang]
    date_re = DATE_RES[cfg["mode"]]
    
    for line in clean_lines(text):
        orders = dates_with_context(line, cfg["order"], cfg["exclude"], date_re)
        deliveries = dates_with_context(line, cfg["deliv"], cfg["exclude"], date_re)
        
        data.orders_count += len(orders)
        data.deliveries_count += len(deliveries)
        
        # Chercher une paire commande + livraison dans la même ligne
        if orders and deliveries and orders[0] != deliveries[0]:
            key = (lang, orders[0], deliveries[0])
            if key in data.seen_pairs:
                continue
            data.seen_pairs.add(key)
            
            d1 = parse_date(orders[0], data.now_year, cfg["mode"])
            d2 = parse_date(deliveries[0], data.now_year, cfg["mode"])
            
            if d1 and d2:
                # Gestion du passage d'année
                if (d2 - d1).days < 7:
                    try:
                        d2 = d2.replace(year=d2.year + 1)
                    except ValueError:
                        continue
                
                days = (d2 - d1).days
                if 10 < days < 200:
                    data.delays[lang].append(days)
                    data.pairs.append((d1, days))
                    if len(data.examples) < 15:
                        data.examples.append(f"[{lang}] {orders[0]} -> {deliveries[0]} = {days} j")

# ---------- Scraping des forums ----------
def scrape_normal_sources(sources, data):
    """Scrape les sources sans protection Cloudflare."""
    for url, kind, lang in sources:
        total_before = sum(len(v) for v in data.delays.values())
        
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
        except Exception as e:
            log.warning(f"[{lang}] Erreur réseau : {url[:50]}...")
            continue
        
        if r.status_code != 200:
            log.warning(f"[{lang}] HTTP {r.status_code} : {url[:50]}...")
            continue
        
        if kind == "html":
            analyze_text(r.text, lang, data)
        elif kind == "discourse":
            try:
                json_data = r.json()
                for post in json_data.get("post_stream", {}).get("posts", []):
                    analyze_text(post.get("cooked", ""), lang, data)
            except Exception:
                pass
        
        total_after = sum(len(v) for v in data.delays.values())
        if total_after > total_before:
            log.info(f"[{lang}] +{total_after - total_before} paires")
        
        time.sleep(0.3)

def scrape_discourse_topics(data):
    """Cherche des sujets Discourse supplémentaires."""
    try:
        r = requests.get(
            "https://community.club-tesla.fr/search.json?q=livr%C3%A9",
            headers=HEADERS,
            timeout=30
        )
        topics = r.json().get("topics", [])
        ids = [t.get("id") for t in topics if t.get("id")][:8]
        log.info(f"[fr] {len(ids)} sujets Discourse trouvés")
        
        for tid in ids:
            try:
                rt = requests.get(
                    f"https://community.club-tesla.fr/t/{tid}.json",
                    headers=HEADERS,
                    timeout=30
                )
                json_data = rt.json()
                for post in json_data.get("post_stream", {}).get("posts", []):
                    analyze_text(post.get("cooked", ""), "fr", data)
            except Exception:
                continue
            time.sleep(0.3)
    except Exception as e:
        log.warning(f"[fr] Recherche Discourse impossible : {e}")

def scrape_cloudflare_sources(sources, data):
    """Scrape les sources avec protection Cloudflare."""
    scraper_cf = cloudscraper.create_scraper()
    
    for url, kind, lang in sources:
        total_before = sum(len(v) for v in data.delays.values())
        
        try:
            r = scraper_cf.get(url, timeout=30)
        except Exception as e:
            log.warning(f"[{lang}] Erreur CF : {url[:50]}...")
            continue
        
        if r.status_code != 200:
            log.warning(f"[{lang}] CF HTTP {r.status_code} : {url[:50]}...")
            continue
        
        if kind == "html":
            analyze_text(r.text, lang, data)
        
        total_after = sum(len(v) for v in data.delays.values())
        if total_after > total_before:
            log.info(f"[{lang} CF] +{total_after - total_before} paires")
        
        time.sleep(0.5)

# ---------- Firestore : Rapports utilisateurs ----------
def load_user_reports(db, data):
    """Charge les rapports de livraison soumis par les utilisateurs."""
    try:
        reports = db.collection('rapports').limit(100).stream()
        added = 0
        
        for doc in reports:
            doc_data = doc.to_dict()
            dj = doc_data.get('delai_jours')
            dc = doc_data.get('date_commande', '')
            
            if dj:
                data.delays['app'].append(int(dj))
                added += 1
                d1 = parse_date(dc, data.now_year, 'dm')
                if d1:
                    data.pairs.append((d1, int(dj)))
        
        log.info(f"[app] {added} rapport(s) utilisateur(s) intégré(s)")
    except Exception as e:
        log.error(f"[app] Erreur lecture rapports : {e}")

# ---------- Statistiques ----------
def compute_statistics(data):
    """Calcule les statistiques globales et par cohorte."""
    all_delays = sum(data.delays.values(), [])
    n = len(all_delays)
    
    if n == 0:
        return None
    
    # Statistiques globales
    avg = round(sum(all_delays) / n)
    sorted_delays = sorted(all_delays)
    d_min = sorted_delays[0]
    d_max = sorted_delays[-1]
    
    if n % 2 == 1:
        d_med = sorted_delays[n // 2]
    else:
        d_med = (sorted_delays[n // 2 - 1] + sorted_delays[n // 2]) // 2
    
    # Cohortes par mois de commande
    cohortes = {}
    for d1, days in data.pairs:
        key = f"{d1.year}-{d1.month:02d}"
        cohortes.setdefault(key, []).append(days)
    
    cohort_avg = {
        k: round(sum(v) / len(v))
        for k, v in sorted(cohortes.items())
    }
    
    return {
        'commandes_count': data.orders_count,
        'livraisons_count': data.deliveries_count,
        'delai_moyen_jours': avg,
        'delais_analyses': n,
        'delai_min': d_min,
        'delai_max': d_max,
        'delai_mediane': d_med,
        'cohortes': cohort_avg,
        'paires_fr': len(data.delays['fr']),
        'paires_en': len(data.delays['en']),
        'paires_de': len(data.delays['de']),
        'paires_nl': len(data.delays['nl']),
        'paires_app': len(data.delays['app']),
        'updated_at': firestore.SERVER_TIMESTAMP,
        'examples': data.examples
    }

# ---------- Notifications push ----------
def send_notifications(db, avg):
    """Envoie des notifications push aux abonnés."""
    if not avg:
        log.warning("[push] Pas de moyenne disponible, notifications ignorées")
        return
    
    try:
        abonnes = db.collection('abonnes').limit(100).stream()
        count = 0
        
        for doc in abonnes:
            doc_data = doc.to_dict()
            token = doc_data.get('token')
            dc = doc_data.get('date_commande', '')
            
            # Parser la date de commande
            d1 = parse_fr_date(dc)
            if not token or not d1:
                continue
            
            # Calculer l'estimation
            est = d1 + timedelta(days=avg)
            days_left = (est - datetime.now()).days
            
            # Message personnalisé selon l'imminence
            if -7 <= days_left <= 7:
                body = f"🚗 Ta Model Y approche ! Livraison estimée autour du {est.strftime('%d/%m/%Y')}."
            else:
                # Vérifier la dernière notification
                last = doc_data.get('last_notif_at', '')
                if last:
                    try:
                        last_dt = datetime.fromisoformat(last)
                        if (datetime.now() - last_dt).days < 7:
                            continue  # Déjà notifié cette semaine
                    except ValueError:
                        pass
                
                body = f"📊 Suivi Tesla Tracker : livraison estimée autour du {est.strftime('%d/%m/%Y')} (moyenne communauté : {avg} j)."
            
            # Envoyer la notification
            try:
                rp = requests.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=[{
                        "to": token,
                        "sound": "default",
                        "title": "⚡ Tesla Tracker",
                        "body": body
                    }],
                    timeout=30
                )
                log.info(f"[push] Envoi : {rp.status_code}")
                count += 1
                
                # Mettre à jour last_notif_at
                doc.reference.update({
                    'last_notif_at': datetime.now().isoformat()
                })
            except Exception as e:
                log.warning(f"[push] Erreur envoi : {e}")
        
        log.info(f"[push] {count} notification(s) envoyée(s)")
    except Exception as e:
        log.error(f"[push] Erreur notifications : {e}")

def parse_fr_date(s):
    """Parse une date au format JJ/MM/AAAA."""
    try:
        p = s.strip().split("/")
        return datetime(int(p[2]), int(p[1]), int(p[0]))
    except Exception:
        return None

# ---------- Sauvegarde Firestore ----------
def save_stats(db, stats):
    """Sauvegarde les statistiques dans Firestore."""
    try:
        db.collection('stats').document('global').set(stats, merge=True)
        log.info("✅ Statistiques sauvegardées dans Firestore")
    except Exception as e:
        log.error(f"❌ Erreur sauvegarde Firestore : {e}")

# ---------- Fonction principale ----------
def main():
    """Fonction principale du scraper."""
    log.info("=" * 60)
    log.info("🚀 Tesla Tracker Scraper - Démarrage")
    log.info("=" * 60)
    
    # Initialiser Firebase
    db = init_firebase()
    
    # Initialiser les données
    data = ScraperData()
    
    # Construire les listes de sources
    sources_normal, sources_cloudflare = build_sources()
    
    # Scraper les sources normales
    log.info(f"📡 Scraping de {len(sources_normal)} sources normales...")
    scrape_normal_sources(sources_normal, data)
    
    # Chercher des sujets Discourse supplémentaires
    log.info("🔍 Recherche de sujets Discourse supplémentaires...")
    scrape_discourse_topics(data)
    
    # Scraper les sources Cloudflare
    log.info(f"🛡️ Scraping de {len(sources_cloudflare)} sources Cloudflare...")
    scrape_cloudflare_sources(sources_cloudflare, data)
    
    # Charger les rapports utilisateurs
    log.info("📊 Chargement des rapports utilisateurs...")
    load_user_reports(db, data)
    
    # Calculer les statistiques
    stats = compute_statistics(data)
    
    if not stats:
        log.error("❌ Aucune donnée collectée, arrêt du scraper")
        sys.exit(1)
    
    # Afficher le résumé
    log.info("=" * 60)
    log.info("📈 ANALYSE MULTI-SOURCES")
    log.info("=" * 60)
    log.info(f"FR : {len(data.delays['fr'])} | EN : {len(data.delays['en'])} | "
             f"DE : {len(data.delays['de'])} | NL : {len(data.delays['nl'])} | "
             f"APP : {len(data.delays['app'])}")
    log.info(f"TOTAL : {stats['delais_analyses']} paires | "
             f"Moyenne : {stats['delai_moyen_jours']} j | "
             f"Médiane : {stats['delai_mediane']} j | "
             f"Min : {stats['delai_min']} j | Max : {stats['delai_max']} j")
    log.info(f"Cohortes (mois -> délai) : {stats['cohortes']}")
    log.info(f"Exemples : {stats['examples'][:5]}")
    
    # Sauvegarder les statistiques
    save_stats(db, stats)
    
    # Envoyer les notifications
    log.info("🔔 Envoi des notifications push...")
    send_notifications(db, stats['delai_moyen_jours'])
    
    log.info("=" * 60)
    log.info("✅ Scraper terminé avec succès")
    log.info("=" * 60)

if __name__ == '__main__':
    main()
