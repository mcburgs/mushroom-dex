import React, { useCallback, useMemo, useState } from 'react';
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
import { addPoints, completeMission, getUserProfile, getCachedProfile } from '../../src/storage/userProfile';
import { getUserFinds, getCachedFinds } from '../../src/storage/userFinds';
import { getMysteryLogs, getCachedMysteryLogs } from '../../src/storage/mysteryLogs';
import {
  getWeekKey,
  getWeekStartDate,
  getWeeklyChallenges,
  getWeeklyCompleted,
  claimWeeklyChallengeWithPoints,
} from '../../src/storage/weeklyMissions';
import { getMissionEvaluation } from '../../src/utils/missionEngine';
import {
  Mission,
  MysteryObservation,
  UserFind,
  UserProfile,
  WeeklyChallenge,
} from '../../src/types';
import badgesData from '../../data/badges.json';
import missionsData from '../../data/missions.json';

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

const MISSIONS = missionsData as MissionData[];
const BADGES = badgesData as BadgeData[];
const BADGE_BY_ID = BADGES.reduce((acc, badge) => {
  acc[badge.id] = badge;
  return acc;
}, {} as Record<string, BadgeData>);

function MissionCard({
  mission,
  progress,
  claimable,
  done,
  pending,
  onClaim,
  badgeHint,
}: {
  mission: MissionData | WeeklyChallenge;
  progress: { current: number; target: number };
  claimable: boolean;
  done: boolean;
  pending?: boolean;
  onClaim: () => void;
  badgeHint?: string | null;
}) {
  const pct = Math.min((progress.current / progress.target) * 100, 100);
  const diffColour = DIFFICULTY_COLOUR[mission.difficultyTier] ?? '#5a7a3a';

  return (
    <View
      style={[
        styles.missionCard,
        claimable && styles.missionCardClaimable,
        done && styles.missionCardDone,
      ]}
    >
      <View style={styles.missionTop}>
        <View style={[styles.missionIconBox, { backgroundColor: `${diffColour}22` }]}>
          <Text style={styles.missionIcon}>{mission.emoji}</Text>
        </View>
        <View style={styles.missionMeta}>
          <Text style={styles.missionTitle}>{mission.title}</Text>
          <Text style={styles.missionDesc}>{mission.description}</Text>
        </View>
        <View style={styles.missionPtsBox}>
          <Text style={styles.missionPts}>{`+${mission.rewardPoints}`}</Text>
          <Text style={styles.missionPtsLabel}>pts</Text>
        </View>
      </View>

      <View style={styles.missionTagRow}>
        <Text style={[styles.diffChip, { color: diffColour }]}>{mission.difficultyTier}</Text>
        {badgeHint ? <Text style={styles.badgeHint}>{badgeHint}</Text> : null}
        {mission.repeatable ? <Text style={styles.repeatableHint}>Weekly</Text> : null}
      </View>

      {!done && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(pct)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{`${progress.current} / ${progress.target}`}</Text>
        </View>
      )}

      {claimable || pending ? (
        <TouchableOpacity
          style={[styles.claimButton, pending && styles.claimButtonDisabled]}
          onPress={onClaim}
          disabled={pending}
        >
          <Text style={styles.claimButtonText}>
            {pending ? 'Claiming...' : `Claim +${mission.rewardPoints} pts`}
          </Text>
        </TouchableOpacity>
      ) : null}

      {done ? (
        <View style={styles.completedRow}>
          <Text style={styles.completedLabel}>Completed</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function MissionsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [mysteries, setMysteries] = useState<MysteryObservation[]>([]);
  const [weeklyCompleted, setWeeklyCompleted] = useState<string[]>([]);
  const [tab, setTab] = useState<TabType>('active');
  const [claimingMissionIds, setClaimingMissionIds] = useState<string[]>([]);
  const [claimingWeeklyIds, setClaimingWeeklyIds] = useState<string[]>([]);

  const weekStart = useMemo(() => getWeekStartDate(), []);
  const weeklyChallenges = useMemo(() => getWeeklyChallenges(), []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Sync cache reads — instant render on navigation
      const cp = getCachedProfile(); const cf = getCachedFinds(); const cm = getCachedMysteryLogs();
      if (cp) setProfile(cp);
      if (cf) setFinds(cf);
      if (cm) setMysteries(cm);

      // Background refresh from network
      Promise.all([
        getUserProfile({ force: true }),
        getUserFinds({ force: true }),
        getMysteryLogs({ force: true }),
        getWeeklyCompleted(),
      ]).then(([p, f, m, wc]) => {
        if (!active) return;
        setProfile(p);
        setFinds(f);
        setMysteries(m);
        setWeeklyCompleted(wc);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const completedIds = useMemo(() => new Set(profile?.completedMissions ?? []), [profile]);
  const unlockedBadgeIds = useMemo(() => new Set(profile?.unlockedBadges ?? []), [profile]);
  const weeklyDoneIds = useMemo(() => new Set(weeklyCompleted), [weeklyCompleted]);

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [weeklyEvaluations, setWeeklyEvaluations] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;

      const runEvals = async () => {
        const evals = await Promise.all(
          MISSIONS.map(async (mission) => {
            const done = completedIds.has(mission.id);
            const evaluation = await getMissionEvaluation(mission, finds, profile, mysteries);
            return {
              mission,
              done,
              claimable: !done && evaluation.claimable,
              progress: evaluation.progress,
            };
          })
        );
        setEvaluations(evals);

        const wEvals = await Promise.all(
          weeklyChallenges.map(async (challenge) => {
            const done = weeklyDoneIds.has(challenge.id);
            const evaluation = await getMissionEvaluation(challenge, finds, profile, mysteries, weekStart);
            return {
              challenge,
              done,
              claimable: !done && evaluation.claimable,
              progress: evaluation.progress,
            };
          })
        );
        setWeeklyEvaluations(wEvals);
      };

      runEvals();
    }, [profile, finds, mysteries, completedIds, weeklyDoneIds, weekStart, weeklyChallenges])
  );

  const active = useMemo(() => evaluations.filter((item) => !item.done), [evaluations]);
  const completed = useMemo(() => evaluations.filter((item) => item.done), [evaluations]);
  const claimableCount = useMemo(
    () =>
      active.filter((item) => item.claimable).length +
      weeklyEvaluations.filter((item) => item.claimable).length,
    [active, weeklyEvaluations],
  );
  const shown = useMemo(
    () => (tab === 'active' ? active : completed),
    [active, completed, tab],
  );

async function handleClaim(mission: MissionData) {
    if (!profile || claimingMissionIds.includes(mission.id)) return;
    setClaimingMissionIds((current) => [...current, mission.id]);
    try {
      const updated = await completeMission(mission.id, mission.rewardPoints, mission.rewardBadge);
      setProfile(updated);
      const badge = mission.rewardBadge ? BADGE_BY_ID[mission.rewardBadge] : null;
      const message = badge
        ? `+${mission.rewardPoints} points and the "${badge.title}" badge!`
        : `+${mission.rewardPoints} points added to your profile.`;
      Alert.alert('Mission Complete!', message, [{ text: 'Nice' }]);
    } catch (error) {
      console.warn('[Missions] Mission claim failed:', error);
      Alert.alert('Could not claim mission', 'Please try again in a moment.');
    } finally {
      setClaimingMissionIds((current) => current.filter((id) => id !== mission.id));
    }
  }

  async function handleWeeklyClaim(challenge: WeeklyChallenge) {
    if (!profile || weeklyDoneIds.has(challenge.id) || claimingWeeklyIds.includes(challenge.id)) return;
    setClaimingWeeklyIds((current) => [...current, challenge.id]);
    try {
      const { awarded } = await claimWeeklyChallengeWithPoints(challenge.id, challenge.rewardPoints, getWeekKey());
      if (awarded) {
        // Refresh local state
        const updatedProfile = await getUserProfile();
        setProfile(updatedProfile);
        const updatedWeekly = await getWeeklyCompleted();
        setWeeklyCompleted(updatedWeekly);
        Alert.alert('Weekly Challenge Complete!', `+${challenge.rewardPoints} points added.`);
      }
    } catch (error) {
      console.warn('[Missions] Weekly claim failed:', error);
      Alert.alert('Could not claim weekly challenge', 'Please try again in a moment.');
    } finally {
      setClaimingWeeklyIds((current) => current.filter((id) => id !== challenge.id));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Missions</Text>
        <Text style={styles.subtitle}>
          {`${completed.length} / ${MISSIONS.length} permanent missions completed`}
          {claimableCount > 0 ? ` � ${claimableCount} ready to claim` : ''}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.weeklySection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Weekly Challenges</Text>
            <Text style={styles.sectionSubtle}>Refreshes every Sunday</Text>
          </View>
          <Text style={styles.weeklyIntro}>
            Three rotating goals keep progress moving between your bigger milestones.
          </Text>
          {weeklyEvaluations.map(({ challenge, done, claimable, progress }) => (
            <MissionCard
              key={challenge.id}
              mission={challenge}
              progress={progress}
              claimable={claimable}
              done={done}
              pending={claimingWeeklyIds.includes(challenge.id)}
              onClaim={() => handleWeeklyClaim(challenge)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Badges</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.badgeScroll}
          contentContainerStyle={styles.badgeScrollContent}
        >
          {BADGES.map((badge) => {
            const earned = unlockedBadgeIds.has(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                  {earned ? badge.icon : '??'}
                </Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]} numberOfLines={2}>
                  {badge.title}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Permanent Missions</Text>
          <Text style={styles.sectionSubtle}>One-time achievements</Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'active' && styles.tabActive]}
            onPress={() => setTab('active')}
          >
            <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
              {`Active (${active.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'completed' && styles.tabActive]}
            onPress={() => setTab('completed')}
          >
            <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
              {`Completed (${completed.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {shown.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>{tab === 'active' ? '??' : '??'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'active'
                ? 'All permanent missions are complete. Weekly challenges will keep rotating in.'
                : 'Permanent missions you claim will show up here.'}
            </Text>
          </View>
        ) : (
          shown.map(({ mission, done, claimable, progress }) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              progress={progress}
              claimable={claimable}
              done={done}
              pending={claimingMissionIds.includes(mission.id)}
              onClaim={() => handleClaim(mission)}
                badgeHint={
                  mission.rewardBadge
                  ? `${BADGE_BY_ID[mission.rewardBadge]?.icon ?? '??'} badge`
                  : null
              }
            />
          ))
        )}

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
  weeklySection: { marginBottom: 10 },
  sectionHeadingRow: {
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2d4a1a' },
  sectionSubtle: { fontSize: 12, color: '#8a8a7a', marginTop: 2 },
  weeklyIntro: { fontSize: 13, color: '#5a7a3a', marginBottom: 12, lineHeight: 18 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a8a7a',
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
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
  badgeName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2d4a1a',
    textAlign: 'center',
    lineHeight: 13,
  },
  badgeNameLocked: { color: '#b0b0a0' },
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
    gap: 10,
  },
  diffChip: { fontSize: 11, fontWeight: '700' },
  badgeHint: { fontSize: 11, color: '#8b6914', fontWeight: '600' },
  repeatableHint: { fontSize: 11, color: '#5a7a3a', fontWeight: '700' },
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
  progressLabel: { fontSize: 12, color: '#5a7a3a', fontWeight: '600', minWidth: 44 },
  claimButton: {
    backgroundColor: '#8b6914',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimButtonDisabled: { opacity: 0.65 },
  claimButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  completedRow: { alignItems: 'flex-start' },
  completedLabel: { fontSize: 13, color: '#5a7a3a', fontWeight: '700' },
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
