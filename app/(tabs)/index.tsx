import React, { useCallback, useMemo, useState } from 'react';
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
import { getUserProfile, getCachedProfile } from '../../src/storage/userProfile';
import { getUserFinds, getCachedFinds } from '../../src/storage/userFinds';
import { getMysteryLogs, getCachedMysteryLogs } from '../../src/storage/mysteryLogs';
import { getMissionEvaluation } from '../../src/utils/missionEngine';
import { UserProfile, UserFind, MysteryObservation, Mission, STAGE_THRESHOLDS, ProgressionStage } from '../../src/types';
import mushroomData from '../../data/mushrooms.json';
import missionsData from '../../data/missions.json';
import ActivityFeed from '../../src/components/ActivityFeed';
import {
  getAllFriendsFindsIndex,
  getCachedFriendsFindsIndex,
  FriendFindEntry,
} from '../../src/storage/friendData';

const STAGE_EMOJI: Record<string, string> = {
  'Explorer':           '🌱',
  'Tracker':            '👣',
  'Observer':           '👁️',
  'Naturalist':         '🌿',
  'Field Expert':       '🍄',
  'Mycologist':         '🔬',
  'Master Mycologist':  '🏆',
};

const STAGE_NEXT: Record<string, ProgressionStage | null> = {
  'Explorer':          'Tracker',
  'Tracker':           'Observer',
  'Observer':          'Naturalist',
  'Naturalist':        'Field Expert',
  'Field Expert':      'Mycologist',
  'Mycologist':        'Master Mycologist',
  'Master Mycologist': null,
};

type MissionData = Mission & { emoji: string };

const TOTAL_DEX = mushroomData.length;
const MISSIONS = missionsData as MissionData[];
const MUSHROOM_NAME_BY_ID = (mushroomData as any[]).reduce((acc, entry) => {
  if (entry?.id) {
    acc[entry.id] = entry.commonName ?? entry.id;
  }
  return acc;
}, {} as Record<string, string>);

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [mysteries, setMysteries] = useState<MysteryObservation[]>([]);
  const [friendActivity, setFriendActivity] = useState<FriendFindEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Synchronous cache reads — populate state immediately with no network wait.
      // On first launch caches are empty so this is a no-op; subsequent navigations
      // back to the home tab render the correct data before the first paint.
      const cachedProfile = getCachedProfile();
      const cachedFinds   = getCachedFinds();
      const cachedLogs    = getCachedMysteryLogs();
      if (cachedProfile) setProfile(cachedProfile);
      if (cachedFinds)   setFinds(cachedFinds);
      if (cachedLogs)    setMysteries(cachedLogs);

      // Background async refresh — keeps data in sync with Firestore / AsyncStorage.
      Promise.all([
        getUserProfile({ force: true }),
        getUserFinds({ force: true }),
        getMysteryLogs({ force: true }),
      ]).then(([p, f, m]) => {
        if (!active) return;
        setProfile(p);
        setFinds(f);
        setMysteries(m);
      });

      // Load friend activity feed
      const cachedIdx = getCachedFriendsFindsIndex();
      if (cachedIdx) setFriendActivity(cachedIdx.allFinds);
      getAllFriendsFindsIndex().then((idx) => {
        if (active) setFriendActivity(idx.allFinds);
      });

      return () => { active = false; };
    }, [])
  );

  const recentFinds = useMemo(
    () =>
      [...finds]
        .sort((a, b) => new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime())
        .slice(0, 3),
    [finds],
  );

  const totalDex = TOTAL_DEX;
  const foundCount = finds.length;

  const stageProgress = useMemo(() => {
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
    return { nextStage, nextThreshold, progressPercent };
  }, [profile]);

  const [activeMissionPreview, setActiveMissionPreview] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      const completedIds = new Set(profile.completedMissions);
      const runPreview = async () => {
        const preview = await Promise.all(
          MISSIONS
            .filter((mission) => !completedIds.has(mission.id))
            .slice(0, 3)
            .map(async (mission) => {
              const evaluation = await getMissionEvaluation(mission, finds, profile, mysteries);
              return {
                mission,
                progress: evaluation.progress,
                claimable: evaluation.claimable,
              };
            })
        );
        setActiveMissionPreview(preview);
      };
      runPreview();
    }, [profile, finds, mysteries])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>🍄 FungiDex</Text>
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
            {stageProgress.nextStage && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${stageProgress.progressPercent}%` }]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {stageProgress.nextThreshold! - profile.totalPoints} pts to {stageProgress.nextStage}
                </Text>
              </View>
            )}
            {!stageProgress.nextStage && (
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
            <Text style={styles.statLabel}>Done</Text>
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
                <Text style={styles.findName}>{MUSHROOM_NAME_BY_ID[find.mushroomEntryId] ?? find.mushroomEntryId}</Text>
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

        {/* Active Missions */}
        <Text style={styles.sectionTitle}>Active Missions</Text>
        {profile && (
          <>
            {(activeMissionPreview ?? []).length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={styles.emptyText}>All missions completed! Check the Missions tab.</Text>
              </View>
            ) : (
              <>
                {(activeMissionPreview ?? []).map(({ mission, progress, claimable }) => {
                  const pct = Math.min((progress.current / progress.target) * 100, 100);
                  return (
                    <TouchableOpacity
                      key={mission.id}
                      style={[styles.missionCard, claimable && styles.missionCardClaimable]}
                      onPress={() => router.push('/(tabs)/missions')}
                    >
                      <Text style={styles.missionEmoji}>{mission.emoji}</Text>
                      <View style={styles.missionInfo}>
                        <Text style={styles.missionTitle}>{mission.title}</Text>
                        <View style={styles.missionBarRow}>
                          <View style={styles.missionBar}>
                            <View style={[styles.missionFill, { width: `${Math.round(pct)}%` }]} />
                          </View>
                          <Text style={styles.missionCount}>{progress.current + '/' + progress.target + ' '}</Text>
                        </View>
                        {claimable && <Text style={styles.missionClaim}>Ready to claim! →</Text>}
                      </View>
                      <Text style={styles.missionPts}>{'+' + mission.rewardPoints + ' '}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity onPress={() => router.push('/(tabs)/missions')}>
                  <Text style={styles.viewAllMissions}>View all missions →</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* Friend Activity */}
        <Text style={styles.sectionTitle}>Friend Activity</Text>
        <ActivityFeed entries={friendActivity} maxItems={10} />

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { paddingTop: 20, paddingBottom: 12 },
  appTitle: { fontSize: 28, fontWeight: '800', color: '#2d4a1a', textAlign: 'center' },
  appSubtitle: { fontSize: 14, color: '#5a7a3a', marginTop: 2, textAlign: 'center' },
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
  statNumber: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  statLabel: { fontSize: 11, color: '#8a8a7a', marginTop: 2, textAlign: 'center' },
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

  // Mission cards on home
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  missionCardClaimable: { borderColor: '#8b6914', borderWidth: 2, backgroundColor: '#fffaf0' },
  missionEmoji: { fontSize: 24, marginRight: 12 },
  missionInfo: { flex: 1 },
  missionTitle: { fontSize: 14, fontWeight: '700', color: '#2d4a1a', marginBottom: 4 },
  missionBarRow: { flexDirection: 'row', alignItems: 'center' },
  missionBar: {
    flex: 1,
    height: 5,
    backgroundColor: '#e8f5d8',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 6,
  },
  missionFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 3 },
  missionCount: { fontSize: 11, color: '#5a7a3a', fontWeight: '600' },
  missionClaim: { fontSize: 11, color: '#8b6914', fontWeight: '700', marginTop: 3 },
  missionPts: { fontSize: 13, color: '#8b6914', fontWeight: '700', marginLeft: 8 },
  viewAllMissions: {
    fontSize: 13,
    color: '#5a7a3a',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },

  bottomPad: { height: 24 },
});

