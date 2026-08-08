import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { db } from './firebase';
import { addDoc, collection } from 'firebase/firestore';

const OFFERS = [
  {
    emoji: '🧳',
    name: 'Tapis 3D toutes saisons',
    why: 'Indispensable dès le 1er jour',
    url: 'https://www.amazon.fr/s?k=tapis+tesla+model+y',
  },
  {
    emoji: '🎞️',
    name: 'Film protection PPF',
    why: 'Protège la peinture neuve',
    url: 'https://www.amazon.fr/s?k=film+ppf+tesla+model+y',
  },
  {
    emoji: '🔌',
    name: 'Câble recharge Type 2',
    why: 'Pour recharger partout',
    url: 'https://www.amazon.fr/s?k=cable+recharge+type+2',
  },
  {
    emoji: '🏠',
    name: 'Wallbox domicile',
    why: 'Recharge complète la nuit',
    url: 'https://www.amazon.fr/s?k=wallbox+tesla',
  },
];

export default function ShopCard({ uid }) {
  const openOffer = async (offer) => {
    try {
      await addDoc(collection(db, 'clicks'), {
        uid: uid || 'anonyme',
        item: offer.name,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      // l'analytique ne doit jamais bloquer l'ouverture
    }
    Linking.openURL(offer.url);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🛒 Prépare ta livraison</Text>
      <Text style={styles.subtitle}>Notre sélection, testée par la communauté</Text>
      {OFFERS.map((o) => (
        <View key={o.name} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{o.emoji} {o.name}</Text>
            <Text style={styles.why}>{o.why}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => openOffer(o)}>
            <Text style={styles.btnText}>Voir</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 20 },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 11, marginBottom: 15 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  name: { color: '#eee', fontSize: 14, fontWeight: 'bold' },
  why: { color: '#888', fontSize: 11 },
  btn: { backgroundColor: '#e82127', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});