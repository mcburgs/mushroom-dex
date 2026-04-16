import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { RankedCandidate } from '../constants/fieldId';

function scoreColor(score: number) {
  if (score >= 6) return '#5a7a3a';
  if (score >= 3) return '#8b6914';
  return '#8a8a7a';
}

function dots(count: number) {
  return '●'.repeat(count) + '○'.repeat(Math.max(0, 5 - count));
}

export default function CandidateStrip({
  candidates,
  enabled = true,
}: {
  candidates: RankedCandidate[];
  enabled?: boolean;
}) {
  if (!enabled) return null;

  const visible = candidates.filter((candidate) => candidate.score >= 3).slice(0, 5);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Live candidates</Text>
      {visible.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Keep observing…</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visible.map((candidate) => {
            const hero = candidate.entry.images.find((image) => image.isHero);
            const borderColor = scoreColor(candidate.score);
            return (
              <View key={candidate.entry.id} style={[styles.tile, { borderColor }]}>
                <View style={styles.imageWrap}>
                  {hero ? (
                    <Image source={{ uri: hero.urlOrLocalPath }} style={styles.image} contentFit="cover" />
                  ) : (
                    <Text style={styles.fallback}>🍄</Text>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {candidate.entry.commonName}
                </Text>
                <Text style={[styles.score, { color: borderColor }]}>{dots(candidate.confidenceDots)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#f9f6f0',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#8a8a7a', marginBottom: 8 },
  placeholder: {
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 14, color: '#8a8a7a', fontWeight: '600' },
  tile: {
    width: 118,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginRight: 8,
  },
  imageWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e8f5d8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  fallback: { fontSize: 20 },
  name: { fontSize: 12, fontWeight: '700', color: '#2d4a1a' },
  score: { fontSize: 11, marginTop: 6, letterSpacing: 0.5 },
});
