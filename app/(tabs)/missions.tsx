import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const UPCOMING_MISSIONS = [
  { emoji: '🌳', label: 'Find a mushroom in a forest' },
  { emoji: '🪵', label: 'Find a bracket fungus on a log' },
  { emoji: '⚪', label: 'Spot a puffball' },
  { emoji: '🍂', label: 'Make a fall find' },
  { emoji: '🔍', label: 'Log a mystery observation' },
];

export default function MissionsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>⭐ Missions</Text>
        <Text style={styles.subtitle}>Challenges and badges</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.comingEmoji}>🗺️</Text>
        <Text style={styles.comingTitle}>Coming in Phase 6</Text>
        <Text style={styles.comingText}>
          Missions will challenge you to find mushrooms in specific biomes, spot certain types, complete your field journal, and develop your naturalist eye.
        </Text>
        <Text style={styles.previewLabel}>Mission previews:</Text>
        {UPCOMING_MISSIONS.map((m, i) => (
          <View key={i} style={styles.previewRow}>
            <Text style={styles.previewEmoji}>{m.emoji}</Text>
            <Text style={styles.previewText}>{m.label}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  comingEmoji: { fontSize: 64, marginBottom: 20 },
  comingTitle: { fontSize: 22, fontWeight: '700', color: '#2d4a1a', marginBottom: 16 },
  comingText: {
    fontSize: 15,
    color: '#5a5a4a',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8d8',
  },
  previewEmoji: { fontSize: 22 },
  previewText: { fontSize: 14, color: '#3a3a2a' },
});
