import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProfile } from '../../src/storage/userProfile';
import { getUserFinds } from '../../src/storage/userFinds';
import { UserProfile, UserFind, STAGE_THRESHOLDS, ProgressionStage } from '../../src/types';
import mushroomData from '../../data/mushrooms.json';

const STAGE_EMOJI: Record<string, string> = {
  Explorer: '🌱',
  Observer: '👁️',
  Naturalist: '🌿',
  'Junior Expert': '🍄',
};

const STAGE_NEXT: Record<string, ProgressionStage | null> = {
  Explorer: 'Observer',
  Observer: 'Naturalist',
  Naturalist: 'Junior Expert',
  'Junior Expert': null,
};

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finds, setFinds] = useState<UserFind[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserProfile().then((p) => { if (active) setProfile(p); });
      getUserFinds().then((f) => { if (active) setFinds(f); });
      return () => { active = false; };
    }, [])
  );

  const recentFinds = [...finds]
    .sort((a, b) => new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime())
    .slice(0, 3);

  const totalDex = mushroomData.length;
  const foundCount = finds.length;

  const nextStage = profile ? STAGE_NEXT[profile.level] : null;
  const nextThreshold = nextStage ? STAGE_THRESHOLDS[nextStage] : null;
  const currentThreshold = profile ? STAGE_THRESHOLDS[profile.level] : 0;
  const progressPercent =
    nextThreshold && profile
      ? Math.min(
          ((profile.totalPoints - currentThreshold) /
            (nextThreshold - currentThreshold)) *
            100,
          100
        )
      : 100;

  function getMushroomName(id: string) {
    const m = (mushroomData as any[]).find((e) => e.id === id);
    return m?.commonName ?? id;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>🍄 Mushroom Dex</Text>
          <Text style={styles.appSubtitle}>Southern Ontario</Text>
        </View>

        {/* Stage card */}
        {profile && (
          <View style={styles.stageCard}>
            <View style={styles.stageRow}>
              <Text style={styles.stageEmoji}>{STAGE_EMOJI[profile.level]}</Text>
              <View style={styles.stageInfo}>
                <Text style={styles.stageName}>{profile.level}</Text>
                <Text style={styles.stagePoints}>{profile.totalPoints} points</Text>
              </View>
            </View>

            {/* Progress bar */}
            {nextStage && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {nextThreshold! - profile.totalPoints} pts to {nextStage}
                </Text>
              </View>
            )}
            {!nextStage && (
              <Text style={styles.maxStageLabel}>Maximum stage reached!</Text>
            )}
          </View>
        )}

        {/* Found count */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{foundCount}</Text>
            <Text style={styles.statLabel}>Found</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalDex}</Text>
            <Text style={styles.statLabel}>In Dex</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {totalDex > 0 ? Math.round((foundCount / totalDex) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
        </View>

        {/* Quick nav */}
        <View style={styles.quickNav}>
          <TouchableOpacity
            style={styles.quickNavButton}
            onPress={() => router.push('/(tabs)/dex')}
          >
            <Text style={styles.quickNavEmoji}>📖</Text>
            <Text style={styles.quickNavLabel}>Browse Dex</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickNavButton}
            onPress={() => router.push('/(tabs)/mystery')}
          >
            <Text style={styles.quickNavEmoji}>🔍</Text>
            <Text style={styles.quickNavLabel}>Log Mystery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickNavButton}
            onPress={() => router.push('/(tabs)/missions')}
          >
            <Text style={styles.quickNavEmoji}>⭐</Text>
            <Text style={styles.quickNavLabel}>Missions</Text>
          </TouchableOpacity>
        </View>

        {/* Recent finds */}
        <Text style={styles.sectionTitle}>Recent Finds</Text>
        {recentFinds.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>👀</Text>
            <Text style={styles.emptyText}>
              No finds yet! Head to the Dex and mark your first mushroom.
            </Text>
          </View>
        ) : (
          recentFinds.map((find) => (
            <TouchableOpacity
              key={find.id}
              style={styles.findCard}
              onPress={() => router.push(`/dex/${find.mushroomEntryId}`)}
            >
              <Text style={styles.findEmoji}>🍄</Text>
              <View style={styles.findInfo}>
                <Text style={styles.findName}>{getMushroomName(find.mushroomEntryId)}</Text>
                <Text style={styles.findDate}>
                  {new Date(find.dateFound).toLocaleDateString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Missions placeholder */}
        <Text style={styles.sectionTitle}>Active Missions</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyText}>
            Missions unlock as you explore. Check the Missions tab!
          </Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { paddingTop: 20, paddingBottom: 12, alignItems: 'center' },
  appTitle: { fontSize: 28, fontWeight: '800', color: '#2d4a1a' },
  appSubtitle: { fontSize: 14, color: '#5a7a3a', marginTop: 2 },
  stageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stageEmoji: { fontSize: 40, marginRight: 12 },
  stageInfo: {},
  stageName: { fontSize: 20, fontWeight: '700', color: '#2d4a1a' },
  stagePoints: { fontSize: 14, color: '#5a7a3a', marginTop: 2 },
  progressSection: {},
  progressBar: {
    height: 8,
    backgroundColor: '#e8f5d8',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 4 },
  progressLabel: { fontSize: 12, color: '#8a8a7a' },
  maxStageLabel: { fontSize: 13, color: '#5a7a3a', fontStyle: 'italic' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#2d4a1a' },
  statLabel: { fontSize: 12, color: '#8a8a7a', marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: '#e8f5d8' },
  quickNav: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickNavButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  quickNavEmoji: { fontSize: 26 },
  quickNavLabel: { fontSize: 12, color: '#5a7a3a', fontWeight: '600', marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8d8',
    marginBottom: 24,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', lineHeight: 20 },
  findCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  findEmoji: { fontSize: 28, marginRight: 12 },
  findInfo: {},
  findName: { fontSize: 16, fontWeight: '600', color: '#2d4a1a' },
  findDate: { fontSize: 13, color: '#8a8a7a', marginTop: 2 },
  bottomPad: { height: 24 },
});
