import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { db } from './firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';

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
  container