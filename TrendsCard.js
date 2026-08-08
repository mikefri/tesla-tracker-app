import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function CohortChart({ cohortes }) {
  const entries = Object.entries(cohortes || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);
  if (!entries.length) return null;
  const maxVal = Math.max(...entries.map(([, v]) => Number(v)));
  return (
    <View style={styles.chartBox}>
      <Text style={styles.sectionLabel}>Délai moyen par mois de commande</Text>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.cohortRow}>
          <Text style={styles.cohortLabel}>{k}</Text>
          <View style={styles.cohortBarBg}>
            <View style={[styles.cohortBarFill, { width: `${(Number(v) / maxVal) * 100}%` }]} />
          </View>
          <Text style={styles.cohortValue}>{v} j</Text>
        </View>
      ))}
    </View>
  );
}

export default function TrendsCard({ stats, orderDate }) {
  if (!stats) return null;

  let myCohort = null;
  let cohortLabel = null;
  const p = (orderDate || '').trim().split('/');
  if (p.length === 3) {
    const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (stats.cohortes && stats.cohortes[key]) {
        myCohort = stats.cohortes[key];
        cohortLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      }
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📈 Tendances de livraison</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.delai_mediane || '—'}</Text>
          <Text style={styles.statLabel}>médiane (j)</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.delai_min || '—'}</Text>
          <Text style={styles.statLabel}>le + rapide</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.delai_max || '—'}</Text>
          <Text style={styles.statLabel}>le + long</Text>
        </View>
      </View>

      {myCohort ? (
        <View style={styles.cohortBox}>
          <Text style={styles.cohortTitle}>👥 Ta cohorte</Text>
          <Text style={styles.cohortText}>
            Les commandes de {cohortLabel} ont été livrées en {myCohort} jours en moyenne.
          </Text>
        </View>
      ) : (
        <Text style={styles.cohortHint}>
          Entre ta date de commande pour voir les stats de ta cohorte.
        </Text>
      )}

      <CohortChart cohortes={stats.cohortes} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%', backgroundColor: '#1a1a1a', borderRadius: 24,
    padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 40, backgroundColor: '#2a2a2a' },
  statNumber: { color: '#fff', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 10, marginTop: 4 },
  cohortBox: {
    backgroundColor: '#101820', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#1e3a4f', marginBottom: 16,
  },
  cohortTitle: { color: '#4fc3f7', fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  cohortText: { color: '#ddd', fontSize: 13 },
  cohortHint: { color: '#666', fontSize: 12, fontStyle: 'italic', marginBottom: 12 },
  chartBox: { marginTop: 4 },
  sectionLabel: { color: '#aaa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  cohortRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cohortLabel: { color: '#888', fontSize: 11, width: 62 },
  cohortBarBg: { flex: 1, height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  cohortBarFill: { height: '100%', backgroundColor: '#e82127', borderRadius: 4 },
  cohortValue: { color: '#fff', fontSize: 11, width: 40, textAlign: 'right' },
});