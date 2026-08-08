import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { db } from './firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const snap = await getDoc(doc(db, 'stats', 'global'));
        if (snap.exists()) {
          setStats(snap.data());
        }
      } catch (e) {
        console.log('Erreur stats :', e);
      }
    };
    loadStats();
  }, []);

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
              <Text style={styles.statNumber}>{stats.livraisons_count}</Text>
              <Text style={styles.statLabel}>livraisons rapportées</Text>
            </View>
          </View>
          {stats.dernieres_livraisons ? (
            <Text style={styles.statsFooter}>
              Dernières livraisons : {stats.dernieres_livraisons.slice(-5).join(' • ')}
            </Text>
          ) : null}
        </View>
      )}

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
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  statBox: { alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 11 },
  statsFooter: { color: '#666', fontSize: 11, textAlign: 'center' },
  card: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 30 },
  label: { color: '#ccc', fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 10,
    color: '#fff', paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 15,
  },
  button: { backgroundColor: '#e82127', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  timeline: { width: '100%', paddingLeft: 10 },
  step: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#333', marginRight: 12 },
  dotDone: { backgroundColor: '#2ecc71' },
  dotActive: { backgroundColor: '#e82127' },
  stepText: { color: '#ccc', fontSize: 14 },
  line: { width: 2, height: 24, backgroundColor: '#333', marginLeft: 6, marginVertical: 4 },
});