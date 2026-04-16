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
import { getUserProfile, getCachedProfile } from '../../src/storage/userProfile';
import { UserProfile, ProgressionStage, STAGE_THRESHOLDS, LearnLesson, CurriculumTier } from '../../src/types';
import { CAT_EMOJI, CAT_BADGE_COLORS, TIER_META } from '../../src/constants/lessonCategories';
import lessonsData from '../../data/lessons.json';

const STAGE_ORDER: ProgressionStage[] = [
  'Explorer',
  'Tracker',
  'Observer',
  'Naturalist',
  'Field Expert',
  'Mycologist',
  'Master Mycologist',
];

export default function LearnScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [collapsedTiers, setCollapsedTiers] = useState<Record<number, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Synchronous cache read — applies immediately so the screen never renders
      // with stale data after returning from a completed lesson.
      const cached = getCachedProfile();
      if (cached) setProfile(cached);

      // Background async refresh — picks up any server-side changes (other devices,
      // admin updates, etc.) and re-renders only if something actually changed.
      getUserProfile({ force: true }).then((p) => {
        if (active) setProfile(p);
      });

      return () => { active = false; };
    }, [])
  );

  const lessons = lessonsData as unknown as LearnLesson[];
  const completedIds = new Set(profile?.completedLessons ?? []);
  const userStageIdx = profile ? STAGE_ORDER.indexOf(profile.level) : 0;

  function isTierUnlocked(tier: CurriculumTier): boolean {
    const meta = TIER_META[tier - 1];
    const requiredIdx = STAGE_ORDER.indexOf(meta.unlockStage as ProgressionStage);
    return userStageIdx >= requiredIdx;
  }

  // Group by tier
  const byTier: Record<number, LearnLesson[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const lesson of lessons) {
    byTier[lesson.tier]?.push(lesson);
  }

  const nextStage = profile ? STAGE_ORDER[userStageIdx + 1] ?? null : null;
  const nextThreshold = nextStage ? STAGE_THRESHOLDS[nextStage] : null;
  const currentThreshold = profile ? STAGE_THRESHOLDS[profile.level] : 0;
  const progressPct = nextThreshold && profile
    ? Math.min(
        ((profile.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
        100
      )
    : 100;

  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;

  function toggleTier(tier: number) {
    setCollapsedTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🌿 Learn</Text>
        <Text style={styles.subtitle}>Lessons and field knowledge</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Progress card */}
        {profile && (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View>
                <Text style={styles.progressStage}>{profile.level}</Text>
                <Text style={styles.progressPoints}>{profile.totalPoints + ' points'}</Text>
              </View>
              <View style={styles.progressRight}>
                <Text style={styles.progressLessons}>
                  {completedCount + ' / ' + lessons.length + ' lessons done'}
                </Text>
              </View>
            </View>
            {nextStage && (
              <View style={styles.progressBarSection}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.round(progressPct)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {(nextThreshold! - profile.totalPoints) + ' pts to unlock ' + nextStage + ' lessons'}
                </Text>
              </View>
            )}
            {!nextStage && (
              <Text style={styles.progressMax}>All lessons unlocked!</Text>
            )}
          </View>
        )}

        {/* Tiers */}
        {TIER_META.map((meta) => {
          const tierLessons = byTier[meta.tier] ?? [];
          if (tierLessons.length === 0) return null;
          const unlocked = isTierUnlocked(meta.tier);
          const collapsed = collapsedTiers[meta.tier] ?? false;
          const tierCompleted = tierLessons.filter((l) => completedIds.has(l.id)).length;

          return (
            <View key={meta.tier} style={styles.tierSection}>
              <TouchableOpacity
                style={[styles.tierHeader, { backgroundColor: meta.light }]}
                onPress={() => toggleTier(meta.tier)}
                activeOpacity={0.7}
              >
                <View style={[styles.tierPill, { backgroundColor: meta.color }]}>
                  <Text style={styles.tierPillText}>{meta.emoji + ' Tier ' + meta.tier}</Text>
                </View>
                <Text style={[styles.tierName, { color: meta.dark }]}>{meta.name}</Text>
                {unlocked ? (
                  <Text style={[styles.tierCount, { color: meta.dark }]}>
                    {tierCompleted + ' / ' + tierLessons.length}
                  </Text>
                ) : (
                  <Text style={styles.tierLocked}>
                    {'🔒 ' + STAGE_THRESHOLDS[meta.unlockStage as ProgressionStage] + ' pts'}
                  </Text>
                )}
                <Text style={[styles.tierChevron, { color: meta.dark }]}>
                  {collapsed ? '▶' : '▼'}
                </Text>
              </TouchableOpacity>

              {!collapsed && tierLessons.map((lesson) => {
                const done = completedIds.has(lesson.id);
                const catEmoji = CAT_EMOJI[lesson.cat] ?? '📖';
                const [catBg, catFg] = CAT_BADGE_COLORS[lesson.cat] ?? ['#f1efe8', '#444'];
                const hasImage = lesson.images.length > 0;

                if (!unlocked) {
                  return (
                    <View key={lesson.id} style={styles.cardLocked}>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitleLocked}>{lesson.title}</Text>
                        <View style={[styles.catBadge, { backgroundColor: catBg }]}>
                          <Text style={[styles.catBadgeText, { color: catFg }]}>
                            {catEmoji + ' ' + lesson.cat}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.lockIcon}>🔒</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[styles.card, done && styles.cardDone]}
                    onPress={() => router.push(`/learn/${lesson.id}`)}
                  >
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{lesson.title}</Text>
                      <View style={[styles.catBadge, { backgroundColor: catBg }]}>
                        <Text style={[styles.catBadgeText, { color: catFg }]}>
                          {catEmoji + ' ' + lesson.cat}
                        </Text>
                      </View>
                      <Text style={styles.cardSummary} numberOfLines={2}>
                        {lesson.summary}
                      </Text>
                      {done ? (
                        <Text style={styles.cardDoneLabel}>✓ Completed</Text>
                      ) : (
                        <Text style={styles.cardCta}>Tap to start →</Text>
                      )}
                    </View>
                    {hasImage && (
                      <Image
                        source={{ uri: lesson.images[0].url }}
                        style={styles.cardThumb}
                      />
                    )}
                    {done && (
                      <View style={styles.doneCheck}>
                        <Text style={styles.doneCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
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

  // Progress card
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 24,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  progressStage: { fontSize: 18, fontWeight: '700', color: '#2d4a1a' },
  progressPoints: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },
  progressRight: { alignItems: 'flex-end' },
  progressLessons: { fontSize: 13, color: '#5a7a3a', fontWeight: '600' },
  progressBarSection: {},
  progressBar: {
    height: 8,
    backgroundColor: '#e8f5d8',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 4 },
  progressLabel: { fontSize: 12, color: '#8a8a7a' },
  progressMax: { fontSize: 13, color: '#5a7a3a', fontStyle: 'italic' },

  // Tier section
  tierSection: { marginBottom: 20 },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  tierPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 10,
  },
  tierPillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  tierName: { flex: 1, fontSize: 14, fontWeight: '600' },
  tierCount: { fontSize: 12, fontWeight: '600', marginRight: 8 },
  tierLocked: { fontSize: 12, color: '#8a8a7a', fontWeight: '600', marginRight: 8 },
  tierChevron: { fontSize: 11 },

  // Lesson card — unlocked
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8d8',
    marginBottom: 10,
    padding: 14,
    alignItems: 'center',
  },
  cardDone: { borderColor: '#5a7a3a', borderWidth: 2 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 4 },
  catBadge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  cardSummary: { fontSize: 12, color: '#5a5a4a', lineHeight: 17, marginBottom: 4 },
  cardDoneLabel: { fontSize: 12, color: '#5a7a3a', fontWeight: '700' },
  cardCta: { fontSize: 12, color: '#5a7a3a', fontWeight: '600' },
  cardThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#e8e8d8',
    marginLeft: 10,
  },
  doneCheck: {
    width: 28,
    height: 28,
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  doneCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Lesson card — locked
  cardLocked: {
    flexDirection: 'row',
    backgroundColor: '#f4f4ec',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8d8',
    marginBottom: 10,
    padding: 14,
    alignItems: 'center',
    opacity: 0.7,
  },
  cardTitleLocked: { fontSize: 15, fontWeight: '700', color: '#8a8a7a', marginBottom: 4 },
  lockIcon: { fontSize: 20, marginLeft: 8 },

  bottomPad: { height: 32 },
});
