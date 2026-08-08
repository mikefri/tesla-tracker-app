import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, ScrollView, Platform, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { db, auth } from './firebase';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from 'firebase/auth';
import ShopCard from './ShopCard';

const { width } = Dimensions.get('window');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true,
    shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || password.length < 6) {
      alert('Email valide + mot de passe de 6 caractères minimum.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') alert('Cet email a déjà un compte : connecte-toi.');
      else if (e.code === 'auth/weak-password') alert('Mot de passe trop faible (6 caractères min).');
      else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') alert('Email ou mot de passe incorrect.');
      else alert('Erreur : ' + e.code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.authContainer}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.authContent}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoBig}>⚡</Text>
        </View>
        <Text style={styles.logoTitle}>Tesla Tracker</Text>
        <Text style={styles.authSubtitle}>
          {isLogin ? 'Bon retour parmi nous' : 'Suivez votre Model Y en temps réel'}
        </Text>

        <View style={styles.authCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>📧 Email</Text>
            <TextInput
              style={styles.authInput} placeholder="ton@email.com" placeholderTextColor="#555"
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>🔒 Mot de passe</Text>
            <TextInput
              style={styles.authInput} placeholder="6 caractères minimum" placeholderTextColor="#555"
              value={password} onChangeText={setPassword} secureTextEntry
            />
          </View>
          <TouchableOpacity style={styles.authButton} onPress={handleAuth} disabled={loading} activeOpacity={0.8}>
            <LinearGradient
              colors={['#e82127', '#b81820']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.authButtonGradient}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authButtonText}>{isLogin ? 'Se connecter' : 'Créer mon compte'}</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleBox}>
            <Text style={styles.toggleText}>
              {isLogin ? 'Pas de compte ? Crée-en un' : 'Déjà un compte ? Connecte-toi'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Carte HERO avec le compte à rebours
function CountdownHero({ orderDate, estimate, stats, avg }) {
  if (!estimate || !orderDate) return null;
  const parts = estimate.split('/');
  const estDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  const today = new Date();
  const daysLeft = Math.ceil((estDate - today) / 86400000);

  let status, statusColor, emoji, subtitle;
  if (daysLeft < 0) {
    status = 'LIVRÉE';
    statusColor = '#2ecc71';
    emoji = '🎉';
    subtitle = 'Votre Model Y est arrivée !';
  } else if (daysLeft <= 7) {
    status = 'IMMINENTE';
    statusColor = '#f39c12';
    emoji = '🚗';
    subtitle = 'Elle approche à grands pas !';
  } else if (daysLeft <= 30) {
    status = 'EN ROUTE';
    statusColor = '#e82127';
    emoji = '🚢';
    subtitle = 'Production terminée, en transit';
  } else if (daysLeft <= 60) {
    status = 'EN PRODUCTION';
    statusColor = '#e82127';
    emoji = '🏭';
    subtitle = 'À Berlin en ce moment';
  } else {
    status = 'CONFIRMÉE';
    statusColor = '#4fc3f7';
    emoji = '✅';
    subtitle = 'Votre commande est en attente';
  }

  const progress = Math.max(0, Math.min(100, 100 - (daysLeft / avg) * 100));

  return (
    <LinearGradient
      colors={['#1a1a1a', '#0d0d0d']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroTop}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
        <Text style={styles.heroEmoji}>{emoji}</Text>
      </View>

      <Text style={styles.heroSubtitle}>{subtitle}</Text>

      <View style={styles.heroMainRow}>
        <View>
          <Text style={styles.heroCountLabel}>Jours restants</Text>
          <Text style={styles.heroCountNumber}>{daysLeft > 0 ? daysLeft : '0'}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View>
          <Text style={styles.heroCountLabel}>Livraison estimée</Text>
          <Text style={styles.heroCountDate}>{estimate}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={['#e82127', '#2ecc71']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          Progression : {Math.round(progress)}%
        </Text>
      </View>
    </LinearGradient>
  );
}

function InteractiveTimeline({ orderDate, estimate, avg }) {
  const steps = [
    { key: 'cmd', label: 'Commande', icon: '📝' },
    { key: 'prod', label: 'Production', icon: '🏭' },
    { key: 'trans', label: 'Transport', icon: '🚢' },
    { key: 'del', label: 'Livraison', icon: '🏁' },
  ];

  let activeIndex = 0;
  if (orderDate && estimate && avg) {
    const parts = estimate.split('/');
    const estDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const today = new Date();
    const daysLeft = Math.ceil((estDate - today) / 86400000);
    if (daysLeft < 0) activeIndex = 4;
    else if (daysLeft <= 7) activeIndex = 3;
    else if (daysLeft <= 30) activeIndex = 2;
    else if (daysLeft <= 60) activeIndex = 1;
    else activeIndex = 0;
  }

  return (
    <View style={styles.timelineCard}>
      <Text style={styles.cardTitle}>📍 Où en est votre Model Y ?</Text>
      <View style={styles.timeline}>
        {steps.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <React.Fragment key={step.key}>
              <View style={styles.step}>
                <View style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isActive && styles.dotActive,
                ]}>
                  <Text style={styles.dotIcon}>{isDone ? '✓' : step.icon}</Text>
                </View>
                <Text style={[
                  styles.stepLabel,
                  isDone && styles.stepLabelDone,
                  isActive && styles.stepLabelActive,
                ]}>
                  {step.label}
                </Text>
              </View>
              {i < steps.length - 1 && (
                <View style={styles.lineContainer}>
                  <LinearGradient
                    colors={isDone ? ['#2ecc71', '#2ecc71'] : ['#333', '#333']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={styles.line}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const snap = await getDoc(doc(db, 'stats', 'global'));
        if (snap.exists()) setStats(snap.data());
      } catch (e) {
        console.log('Erreur stats :', e);
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadMine = async () => {
      try {
        const q = query(collection(db, 'commandes'), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          if (d.rn) setOrderNumber(d.rn);
          if (d.date_commande) setOrderDate(d.date_commande);
        }
      } catch (e) {
        console.log('Erreur commande perso :', e);
      }
    };
    loadMine();
  }, [user]);

  const parseDateFR = (s) => {
    const p = s.trim().split('/');
    if (p.length !== 3) return null;
    const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    return isNaN(d.getTime()) ? null : d;
  };

  const computeEstimate = () => {
    if (!stats || !stats.delai_moyen_jours) {
      alert('Les statistiques ne sont pas encore chargées.');
      return;
    }
    const d = parseDateFR(orderDate);
    if (!d) {
      alert('Format attendu : JJ/MM/AAAA (ex: 10/06/2026)');
      return;
    }
    d.setDate(d.getDate() + Number(stats.delai_moyen_jours));
    setEstimate(d.toLocaleDateString('fr-FR'));
  };

  const enableAlerts = async () => {
    if (!Device.isDevice) {
      alert('Les notifications nécessitent un vrai téléphone.');
      return;
    }
    if (!parseDateFR(orderDate)) {
      alert('Entre d\'abord ta date de commande (JJ/MM/AAAA).');
      return;
    }
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) {
        alert('Permission notifications refusée.');
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      await addDoc(collection(db, 'abonnes'), {
        token: token,
        uid: user.uid,
        date_commande: orderDate.trim(),
        createdAt: new Date().toISOString(),
      });
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token, sound: 'default', title: '⚡ Tesla Tracker',
          body: '✅ Alertes activées ! On surveille ta Model Y.',
        }),
      });
      alert('🔔 Alertes activées ! Regarde tes notifications.');
    } catch (e) {
      alert('Erreur notifications : ' + e.message);
    }
  };

  const reportDelivery = async () => {
    const d1 = parseDateFR(orderDate);
    const d2 = parseDateFR(deliveryDate);
    if (!d1 || !d2) {
      alert('Deux dates au format JJ/MM/AAAA sont nécessaires (commande + livraison).');
      return;
    }
    const days = Math.round((d2 - d1) / 86400000);
    if (days < 10 || days > 200) {
      alert('Délai improbable entre tes deux dates, vérifie-les.');
      return;
    }
    try {
      await addDoc(collection(db, 'rapports'), {
        uid: user.uid,
        date_commande: orderDate.trim(),
        date_livraison: deliveryDate.trim(),
        delai_jours: days,
        createdAt: new Date().toISOString(),
      });
      alert('🙏 Merci ! Ton expérience améliore la prédiction de toute la communauté.');
      setDeliveryDate('');
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  };

  const handleTrackOrder = async () => {
    const rn = orderNumber.trim().toUpperCase();
    if (!rn) {
      alert('Entre ton numéro de commande (ex: RN123456)');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'commandes'), {
        uid: user.uid,
        rn: rn,
        date_commande: orderDate.trim(),
        createdAt: new Date().toISOString(),
        status: 'en_attente',
      });
      alert('✅ Commande enregistrée !');
    } catch (error) {
      alert('Erreur : ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <View style={styles.authContainer}>
        <StatusBar style="light" />
        <ActivityIndicator color="#e82127" size="large" />
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  const firstName = user.email.split('@')[0];
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar style="light" />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName} numberOfLines={1}>{firstName}</Text>
        </View>
        <TouchableOpacity onPress={() => signOut(auth)} style={styles.logoutBtn}>
          <Text style={styles.logoutIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* HERO : Countdown */}
      {estimate ? (
        <CountdownHero
          orderDate={orderDate}
          estimate={estimate}
          stats={stats}
          avg={stats?.delai_moyen_jours || 83}
        />
      ) : (
        <View style={styles.emptyHero}>
          <Text style={styles.emptyHeroEmoji}>📅</Text>
          <Text style={styles.emptyHeroTitle}>Entrez votre date de commande</Text>
          <Text style={styles.emptyHeroSub}>pour découvrir votre date de livraison estimée</Text>
        </View>
      )}

      {/* PREDICTION */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Votre prédiction</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date de commande</Text>
          <TextInput
            style={styles.input} placeholder="JJ/MM/AAAA" placeholderTextColor="#555"
            value={orderDate} onChangeText={setOrderDate} keyboardType="numbers-and-punctuation"
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={computeEstimate} activeOpacity={0.8}>
          <LinearGradient
            colors={['#e82127', '#b81820']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>🎯 Calculer ma prédiction</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* TIMELINE INTERACTIVE */}
      {estimate && (
        <InteractiveTimeline
          orderDate={orderDate}
          estimate={estimate}
          avg={stats?.delai_moyen_jours || 83}
        />
      )}

      {/* STATS COMMUNAUTÉ */}
      {stats && (
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>📊 Intelligence communautaire</Text>
            <Text style={styles.statsSub}>Basé sur {stats.delais_analyses} livraisons réelles</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.delai_moyen_jours}</Text>
              <Text style={styles.statLabel}>jours (moy.)</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.commandes_count}</Text>
              <Text style={styles.statLabel}>commandes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.livraisons_count}</Text>
              <Text style={styles.statLabel}>livrées</Text>
            </View>
          </View>
        </View>
      )}

      {/* ACTIONS */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionCard} onPress={enableAlerts} activeOpacity={0.8}>
          <LinearGradient
            colors={['#f39c12', '#e67e22']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.actionGradient}
          >
            <Text style={styles.actionEmoji}>🔔</Text>
            <Text style={styles.actionTitle}>Activer</Text>
            <Text style={styles.actionSub}>les alertes</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => {
          alert('Fonctionnalité en cours de développement');
        }} activeOpacity={0.8}>
          <LinearGradient
            colors={['#3498db', '#2980b9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.actionGradient}
          >
            <Text style={styles.actionEmoji}>📈</Text>
            <Text style={styles.actionTitle}>Vérifier</Text>
            <Text style={styles.actionSub}>les tendances</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* SIGNALEMENT */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎉 Tu as reçu ta Tesla ?</Text>
        <Text style={styles.cardSubtitle}>Contribue à améliorer la communauté</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date de livraison</Text>
          <TextInput
            style={styles.input} placeholder="JJ/MM/AAAA" placeholderTextColor="#555"
            value={deliveryDate} onChangeText={setDeliveryDate} keyboardType="numbers-and-punctuation"
          />
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={reportDelivery} activeOpacity={0.8}>
          <LinearGradient
            colors={['#2ecc71', '#27ae60']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>Signaler ma livraison</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* RN */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔢 Numéro de commande (RN)</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Numéro RN</Text>
          <TextInput
            style={styles.input} placeholder="Ex: RN123456" placeholderTextColor="#555"
            value={orderNumber} onChangeText={setOrderNumber} autoCapitalize="characters"
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={handleTrackOrder} disabled={loading} activeOpacity={0.8}>
          <LinearGradient
            colors={['#e82127', '#b81820']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Enregistrer ma commande</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* BOUTIQUE */}
      <ShopCard uid={user.uid} />

      <Text style={styles.footerText}>Tesla Tracker • v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },

  // AUTH
  authContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  authContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#e82127',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  logoBig: { fontSize: 48 },
  logoTitle: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 8 },
  authSubtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 40 },
  authCard: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 24, padding: 24 },
  authInput: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14,
    color: '#fff', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },
  authButton: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  authButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  toggleBox: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#4fc3f7', fontSize: 13 },

  // HEADER
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { color: '#888', fontSize: 14, marginBottom: 2 },
  userName: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  logoutBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  logoutIcon: { fontSize: 20 },

  // HERO
  heroCard: {
    width: '100%', borderRadius: 24, padding: 24,
    marginBottom: 20, borderWidth: 1, borderColor: '#2a2a2a',
    shadowColor: '#e82127', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  heroEmoji: { fontSize: 40 },
  heroSubtitle: { color: '#aaa', fontSize: 14, marginBottom: 20 },
  heroMainRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  heroCountLabel: { color: '#888', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroCountNumber: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -2 },
  heroCountDate: { color: '#fff', fontSize: 22, fontWeight: '700' },
  heroDivider: { width: 1, height: 50, backgroundColor: '#2a2a2a', marginHorizontal: 20 },
  progressContainer: { marginTop: 4 },
  progressBar: {
    height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { color: '#888', fontSize: 11, marginTop: 8, textAlign: 'center' },

  // EMPTY HERO
  emptyHero: {
    width: '100%', backgroundColor: '#1a1a1a', borderRadius: 24,
    padding: 40, marginBottom: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed',
  },
  emptyHeroEmoji: { fontSize: 48, marginBottom: 12 },
  emptyHeroTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyHeroSub: { color: '#888', fontSize: 13, textAlign: 'center' },

  // CARDS
  card: {
    width: '100%', backgroundColor: '#1a1a1a', borderRadius: 24,
    padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#888', fontSize: 12, marginBottom: 16 },
  inputGroup: { marginBottom: 12, marginTop: 12 },
  inputLabel: { color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14,
    color: '#fff', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },

  // BUTTONS
  primaryButton: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  primaryButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  secondaryButton: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },

  // TIMELINE
  timelineCard: {
    width: '100%', backgroundColor: '#1a1a1a', borderRadius: 24,
    padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  timeline: { marginTop: 16, paddingLeft: 8 },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  dot: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  dotDone: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  dotActive: { backgroundColor: '#e82127', borderColor: '#e82127', shadowColor: '#e82127', shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 },
  dotIcon: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  stepLabel: { color: '#666', fontSize: 15 },
  stepLabelDone: { color: '#2ecc71', fontWeight: '600' },
  stepLabelActive: { color: '#fff', fontWeight: 'bold' },
  lineContainer: { marginLeft: 27, paddingVertical: 2 },
  line: { width: 2, height: 24, borderRadius: 1 },

  // STATS
  statsCard: {
    width: '100%', borderRadius: 24, padding: 20, marginBottom: 16,
    backgroundColor: '#101820', borderWidth: 1, borderColor: '#1e3a4f',
  },
  statsHeader: { marginBottom: 16 },
  statsTitle: { color: '#4fc3f7', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  statsSub: { color: '#888', fontSize: 11 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 40, backgroundColor: '#1e3a4f' },
  statNumber: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },

  // ACTIONS
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  actionCard: { flex: 1, borderRadius: 20, overflow: 'hidden', height: 120 },
  actionGradient: { flex: 1, padding: 16, justifyContent: 'center' },
  actionEmoji: { fontSize: 28, marginBottom: 8 },
  actionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actionSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  footerText: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 20 },
});