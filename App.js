import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, ScrollView, Platform, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { db } from './firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [estimate, setEstimate] = useState(null);

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
        date_commande: orderDate.trim(),
        createdAt: new Date().toISOString(),
      });
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title: '⚡ Tesla Tracker',
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
        rn: rn,
        date_commande: orderDate.trim(),
        createdAt: new Date().toISOString(),
        status: 'en_attente',
      });
      alert('✅ Commande enregistrée dans Firebase !');
      setOrderNumber('');
    } catch (error) {
      alert('Erreur : ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      <Text style={styles.logo}>⚡ Tesla Tracker</Text>
      <Text style={styles.subtitle}>Suivez la construction de votre Model Y en temps réel</Text>

      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Données communauté</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.commandes_count}</Text>
              <Text style={styles.statLabel}>commandes suivies</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.delai_moyen_jours} j</Text>
              <Text style={styles.statLabel}>délai moyen réel</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.delais_analyses}</Text>
              <Text style={styles.statLabel}>livraisons analysées</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Ta date de commande</Text>
        <TextInput
          style={styles.input}
          placeholder="JJ/MM/AAAA (ex: 10/06/2026)"
          placeholderTextColor="#666"
          value={orderDate}
          onChangeText={setOrderDate}
          keyboardType="numbers-and-punctuation"
        />
        <TouchableOpacity style={styles.buttonGreen} onPress={computeEstimate}>
          <Text style={styles.buttonText}>🎯 Calculer ma prédiction</Text>
        </TouchableOpacity>
        {estimate ? (
          <View style={styles.estimateBox}>
            <Text style={styles.estimateText}>Livraison estimée : autour du {estimate}</Text>
            <Text style={styles.estimateSub}>
              Basé sur {stats.delais_analyses} livraisons réelles de la communauté
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>🔔 Alertes de suivi</Text>
        <TouchableOpacity style={styles.buttonOrange} onPress={enableAlerts}>
          <Text style={styles.buttonText}>Activer les alertes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>🎉 Tu as reçu ta Tesla ?</Text>
        <TextInput
          style={styles.input}
          placeholder="Date de livraison (JJ/MM/AAAA)"
          placeholderTextColor="#666"
          value={deliveryDate}
          onChangeText={setDeliveryDate}
          keyboardType="numbers-and-punctuation"
        />
        <TouchableOpacity style={styles.buttonBlue} onPress={reportDelivery}>
          <Text style={styles.buttonText}>Signaler ma livraison</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Numéro de commande (RN)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: RN123456"
          placeholderTextColor="#666"
          value={orderNumber}
          onChangeText={setOrderNumber}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.button} onPress={handleTrackOrder} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Suivre ma commande</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.timeline}>
        <View style={styles.step}>
          <View style={[styles.dot, styles.dotDone]} />
          <Text style={styles.stepText}>Commande confirmée</Text>
        </View>
        <View style={styles.line} />
        <View style={styles.step}>
          <View style={[styles.dot, styles.dotActive]} />
          <Text style={styles.stepText}>Production à Berlin</Text>
        </View>
        <View style={styles.line} />
        <View style={styles.step}>
          <View style={styles.dot} />
          <Text style={styles.stepText}>Transport</Text>
        </View>
        <View style={styles.line} />
        <View style={styles.step}>
          <View style={styles.dot} />
          <Text style={styles.stepText}>Livraison</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20, alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 30 },
  statsCard: {
    width: '100%', backgroundColor: '#101820', borderRadius: 16,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#1e3a4f',
  },
  statsTitle: { color: '#4fc3f7', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 10 },
  card: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 20 },
  label: { color: '#ccc', fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 10,
    color: '#fff', paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 15,
  },
  button: { backgroundColor: '#e82127', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonGreen: { backgroundColor: '#2ecc71', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonBlue: { backgroundColor: '#3498db', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonOrange: { backgroundColor: '#f39c12', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  estimateBox: { marginTop: 15 },
  estimateText: { color: '#2ecc71', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  estimateSub: { color: '#888', fontSize: 11, textAlign: 'center', marginTop: 4 },
  timeline: { width: '100%', paddingLeft: 10 },
  step: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#333', marginRight: 12 },
  dotDone: { backgroundColor: '#2ecc71' },
  dotActive: { backgroundColor: '#e82127' },
  stepText: { color: '#ccc', fontSize: 14 },
  line: { width: 2, height: 24, backgroundColor: '#333', marginLeft: 6, marginVertical: 4 },
});