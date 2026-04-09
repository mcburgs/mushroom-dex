import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProfile, completeMission } from '../../src/storage/userProfile';
import { getUserFinds } from '../../src/storage/userFinds';
import { getMysteryLogs } from '../../src/storage/mysteryLogs';
import { evaluateMission, getMissionProgress } from '../../src/utils/missionEngine';
import { UserProfile, UserFind, MysteryObservation, Mission } from '../../src/types';
import missionsData from '../../data/missions.json';
import badgesData from '../../data/badges.json';

type TabType = 'active' | 'completed';

const DIFFICULTY_COLOUR: Record<string, string> = {
  Beginner: '#5a7a3a',
  Explorer: '#2a6a8a',
  Naturalist: '#8b6914',
  Expert: '#6a1a8b',
};

interface MissionData extends Mission {
  emoji: string;
}

interface BadgeData {
  id: string;
  title: string;
  description: string;
  icon: string;
  pointsBonus: number;
}

export default function MissionsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [mysteries, setMysteries] = useState<MysteryObservation[]>([]);
  const [tab, setTab] = useState<TabType>('active');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getUserProfile(), getUserFinds(), getMysteryLogs()]).then(
        ([p, f, m]) => {
          if (!active) return;
          setProfile(p);
          setFinds(f);
          setMysteries(m);
        }
      );
      return () => { active = false; };
    }, [])
  );

  const missions = missionsData as MissionData[];
  const badges = badgesData as BadgeData[];
  const completedIds = new Set(profile?.completedMissions ?? []);
  const unlockedBadgeIds = new Set(profile?.unlockedBadges ?? []);

  // Evaluate each mission
  const evaluations = missions.map((m) => ({
    mission: m,
    done: completedIds.has(m.id),
    claimable: !completedIds.has(m.id) && profile
      ? evaluateMission(m as unknown as Mission, finds, profile, mysteries)
      : false,
    progress: profile
      ? getMissionProgress(m as unknown as Mission, finds, profile, mysteries)
      : { current: 0, target: 1 },
  }));

  const active = evaluations.filter((e) => !e.done);
  const completed = evaluations.filter((e) => e.done);
  const claimableCount = active.filter((e) => e.claimable).length;

  async function handleClaim(mission: MissionData) {
    if (!profile) return;
    const updated = await completeMission(mission.id, mission.rewardPoints, mission.rewardBadge);
    setProfile(updated);
    const badge = mission.rewardBadge ? badges.find((b) => b.id === mission.rewardBadge) : null;
    const msg = badge
      ? `+${mission.rewardPoints} points and the "${badge.title}" badge!`
      : `+${mission.rewardPoints} points!`;
    Alert.alert('Mission Complete! 🎉', msg, [{ text: 'Awesome!' }]);
  }

  const shown = tab === 'active' ? active : completed;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>⭐ Missions</Text>
        <Text style={styles.subtitle}>
          {completed.length + ' / ' + missions.length + ' completed'}
          {claimableCount > 0 ? ' · ' + claimableCount + ' ready to claim!' : ''}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Badges */}
        <Text style={styles.sectionLabel}>Badges</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.badgeScroll}
          contentContainerStyle={styles.badgeScrollContent}
        >
          {badges.map((badge) => {
            const earned = unlockedBadgeIds.has(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                  {earned ? badge.icon : '🔒'}
                </Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]} numberOfLines={2}>
                  {badge.title + ' '}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'active' && styles.tabActive]}
            onPress={() => setTab('active')}
          >
            <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
              {'Active (' + active.length + ') '}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'completed' && styles.tabActive]}
            onPress={() => setTab('completed')}
          >
            <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
              {'Completed (' + completed.length + ') '}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mission list */}
        {shown.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>{tab === 'active' ? '🏆' : '🌱'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'active'
                ? 'All missions completed! You are a true naturalist.'
                : 'Complete missions to see them here.'}
            </Text>
          </View>
        )}

        {shown.map(({ mission, done, claimable, progress }) => {
          const pct = Math.min((progress.current / progress.target) * 100, 100);
          const diffColour = DIFFICULTY_COLOUR[mission.difficultyTier] ?? '#5a7a3a';

          return (
            <View
              key={mission.id}
              style={[
                styles.missionCard,
                claimable && styles.missionCardClaimable,
                done && styles.missionCardDone,
              ]}
            >
              {/* Top row */}
              <View style={styles.missionTop}>
                <View style={[styles.missionIconBox, { backgroundColor: diffColour + '22' }]}>
                  <Text style={styles.missionIcon}>{mission.emoji}</Text>
                </View>
                <View style={styles.missionMeta}>
                  <Text style={styles.missionTitle}>{mission.title}</Text>
                  <Text style={styles.missionDesc}>{mission.description + ' '}</Text>
                </View>
                <View style={styles.missionPtsBox}>
                  <Text style={styles.missionPts}>{'+' + mission.rewardPoints}</Text>
                  <Text style={styles.missionPtsLabel}>pts</Text>
                </View>
              </View>

              {/* Difficulty + badge hint */}
              <View style={styles.missionTagRow}>
                <Text style={[styles.diffChip, { color: diffColour }]}>
                  {mission.difficultyTier + ' '}
                </Text>
                {mission.rewardBadge && (
                  <Text style={styles.badgeHint}>
                    {(badges.find((b) => b.id === mission.rewardBadge)?.icon ?? '🏅') + ' badge '}
                  </Text>
                )}
              </View>

              {/* Progress bar (active only) */}
              {!done && (
                <View style={styles.progressSection}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.round(pct)}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {progress.current + ' / ' + progress.target + ' '}
                  </Text>
                </View>
              )}

              {/* Claim button */}
              {claimable && (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={() => handleClaim(mission)}
                >
                  <Text style={styles.claimButtonText}>{'Claim +' + mission.rewardPoints + ' pts! 🎉'}</Text>
                </TouchableOpacity>
              )}

              {/* Completed badge */}
              {done && (
                <View style={styles.completedRow}>
                  <Text style={styles.completedLabel}>{'✓ Completed '}</Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { padding: 16 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a8a7a',
    marginBottom: 10,
    letterSpacing: 0.5,
  },

  // Badges
  badgeScroll: { flexGrow: 0, marginBottom: 20 },
  badgeScrollContent: { paddingRight: 8 },
  badgeCard: {
    width: 80,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 10,
    marginRight: 10,
  },
  badgeCardLocked: { backgroundColor: '#f4f4ec', borderColor: '#e8e8d8', opacity: 0.6 },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeIconLocked: { opacity: 0.4 },
  badgeName: { fontSize: 10, fontWeight: '700', color: '#2d4a1a', textAlign: 'center', lineHeight: 13 },
  badgeNameLocked: { color: '#b0b0a0' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#e8f5d8',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#5a7a3a' },
  tabTextActive: { color: '#2d4a1a' },

  // Mission cards
  missionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8d8',
    padding: 14,
    marginBottom: 12,
  },
  missionCardClaimable: {
    borderColor: '#8b6914',
    borderWidth: 2,
    backgroundColor: '#fffaf0',
  },
  missionCardDone: {
    backgroundColor: '#f4f9f0',
    borderColor: '#c8e8b0',
  },
  missionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  missionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missionIcon: { fontSize: 22 },
  missionMeta: { flex: 1 },
  missionTitle: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 2 },
  missionDesc: { fontSize: 13, color: '#5a5a4a', lineHeight: 18 },
  missionPtsBox: { alignItems: 'center', marginLeft: 8 },
  missionPts: { fontSize: 16, fontWeight: '800', color: '#8b6914' },
  missionPtsLabel: { fontSize: 10, color: '#8b6914', fontWeight: '600' },

  missionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  diffChip: { fontSize: 11, fontWeight: '700', marginRight: 10 },
  badgeHint: { fontSize: 11, color: '#8b6914', fontWeight: '600' },

  // Progress
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e8f5d8',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#5a7a3a', fontWeight: '600', minWidth: 40 },

  // Claim
  claimButton: {
    backgroundColor: '#8b6914',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Completed
  completedRow: { alignItems: 'flex-start' },
  completedLabel: { fontSize: 13, color: '#5a7a3a', fontWeight: '700' },

  // Empty
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8d8',
    marginBottom: 12,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', lineHeight: 20 },

  bottomPad: { height: 32 },
});
