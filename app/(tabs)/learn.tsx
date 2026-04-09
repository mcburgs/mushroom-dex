import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LearnScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🌿 Learn</Text>
        <Text style={styles.subtitle}>Lessons and visual glossary</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.comingEmoji}>📚</Text>
        <Text style={styles.comingTitle}>Coming in Phase 5</Text>
        <Text style={styles.comingText}>
          The Learn section will have short lessons on mushroom morphology — caps, gills, pores, spores, stems, and more.
        </Text>
        <Text style={styles.comingText}>
          A visual glossary, simple quizzes, and lessons that unlock as you progress through Explorer → Observer → Naturalist → Junior Expert.
        </Text>
      </ScrollView>
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
    alignItems: 'center',
    padding: 32,
    paddingBottom: 48,
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
