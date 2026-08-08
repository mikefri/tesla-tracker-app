import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { db } from './firebase';
import { addDoc, collection } from 'firebase/firestore';

export default function App() {
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);

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
    <View style={styles.container}>
      <StatusBar style="light" />

      <Text style={styles.logo}>⚡ Tesla Tracker</Text>
      <Text style={styles.subtitle}>Suivez la construction de votre Model Y en temps réel</Text>

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
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Suivre ma commande</Text>
          )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 40 },
  card: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 40 },
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