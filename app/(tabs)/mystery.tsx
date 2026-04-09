import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MysteryScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Mystery Finder</Text>
        <Text style={styles.subtitle}>Guided field observation</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.comingEmoji}>🔬</Text>
        <Text style={styles.comingTitle}>Coming in Phase 4</Text>
        <Text style={styles.comingText}>
          The Mystery Finder will walk you through field questions — substrate, cap shape, underside, stem, colour, and more — and help narrow down what broad group your mushroom might belong to.
        </Text>
        <Text style={styles.comingText}>
          You'll earn points for every well-documented mystery log, even without a definite ID.
        </Text>
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
    marginBottom: 14,
  },
});
