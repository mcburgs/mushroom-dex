import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProfile } from '../../src/storage/userProfile';
import { UserProfile, ProgressionStage, STAGE_THRESHOLDS } from '../../src/types';
import lessonsData from '../../data/lessons.json';

const STAGE_ORDER: ProgressionStage[] = ['Explorer', 'Observer', 'Naturalist', 'Junior Expert'];

const STAGE_COLOUR: Record<string, string> = {
  Explorer: '#5a7a3a',
  Observer: '#2a6a8a',
  Naturalist: '#8b6914',
  'Junior Expert': '#6a1a8b',
};

const TOPIC_EMOJI: Record<string, string> = {
  'Fungi Basics': '🧫',
  'Stay Safe': '⚠️',
  'Broad Types': '🍄',
  'Morphology': '🔬',
  'Habitat': '🌲',
  'Field Observation': '👁️',
  'Advanced ID': '🔭',
};

interface Lesson {
  id: string;
  title: string;
  topic: string;
  unlockTier: ProgressionStage;
  body: string;
  quizQuestions: unknown[];
}

export default function LearnScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserProfile().then((p) => { if (active) setProfile(p); });
      return () => { active = false; };
    }, [])
  );

  const lessons = lessonsData as Lesson[];
  const completedIds = new Set(profile?.completedLessons ?? []);
  const userStageIdx = profile ? STAGE_ORDER.indexOf(profile.level) : 0;

  function isUnlocked(lesson: Lesson): boolean {
    const lessonStageIdx = STAGE_ORDER.indexOf(lesson.unlockTier);
    return lessonStageIdx <= userStageIdx;
  }

  // Group by unlock tier
  const byTier: Record<string, Lesson[]> = {};
  for (const lesson of lessons) {
    if (!byTier[lesson.unlockTier]) byTier[lesson.unlockTier] = [];
    byTier[lesson.unlockTier].push(lesson);
  }

  const nextStage = profile && profile.level !== 'Junior Expert'
    ? STAGE_ORDER[userStageIdx + 1]
    : null;
  const nextThreshold = nextStage ? STAGE_THRESHOLDS[nextStage] : null;
  const currentThreshold = profile ? STAGE_THRESHOLDS[profile.level] : 0;
  const progressPct = nextThreshold && profile
    ? Math.min(
        ((profile.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
        100
      )
    : 100;

  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;

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
                <Text style={styles.progressPoints}>{profile.totalPoints + ' points '}</Text>
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
                  {(nextThreshold! - profile.totalPoints) + ' pts to unlock ' + nextStage + ' lessons '}
                </Text>
              </View>
            )}
            {!nextStage && (
              <Text style={styles.progressMax}>All lessons unlocked!</Text>
            )}
          </View>
        )}

        {/* Lessons by tier */}
        {STAGE_ORDER.map((tier) => {
          const tierLessons = byTier[tier] ?? [];
          if (tierLessons.length === 0) return null;
          const tierUnlocked = STAGE_ORDER.indexOf(tier) <= userStageIdx;
          return (
            <View key={tier}>
              <View style={styles.tierHeader}>
                <View style={[styles.tierBadge, { backgroundColor: STAGE_COLOUR[tier] }]}>
                  <Text style={styles.tierBadgeText}>{tier + ' '}</Text>
                </View>
                {!tierUnlocked && (
                  <Text style={styles.tierLocked}>🔒 Locked</Text>
                )}
              </View>

              {tierLessons.map((lesson) => {
                const unlocked = isUnlocked(lesson);
                const done = completedIds.has(lesson.id);
                const topicEmoji = TOPIC_EMOJI[lesson.topic] ?? '📖';

                if (!unlocked) {
                  return (
                    <View key={lesson.id} style={styles.cardLocked}>
                      <Text style={styles.cardLockedEmoji}>🔒</Text>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitleLocked}>{lesson.title}</Text>
                        <Text style={styles.cardTopic}>{topicEmoji + ' ' + lesson.topic + ' '}</Text>
                        <Text style={styles.cardUnlockHint}>
                          {'Unlocks at ' + lesson.unlockTier + ' '}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[styles.card, done && styles.cardDone]}
                    onPress={() => router.push(`/learn/${lesson.id}`)}
                  >
                    <View style={styles.cardIcon}>
                      <Text style={styles.cardIconText}>{topicEmoji}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{lesson.title}</Text>
                      <Text style={styles.cardTopic}>{lesson.topic + ' '}</Text>
                      {done ? (
                        <Text style={styles.cardDoneLabel}>{'✓ Completed '}</Text>
                      ) : (
                        <Text style={styles.cardCta}>{'Tap to start → '}</Text>
                      )}
                    </View>
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

  // Tier header
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  tierBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 10,
    alignSelf: 'flex-start',
  },
  tierBadgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  tierLocked: { fontSize: 13, color: '#8a8a7a', fontWeight: '600' },

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
  cardIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#e8f5d8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIconText: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#2d4a1a' },
  cardTopic: { fontSize: 12, color: '#8a8a7a', marginTop: 2 },
  cardDoneLabel: { fontSize: 12, color: '#5a7a3a', fontWeight: '700', marginTop: 4 },
  cardCta: { fontSize: 12, color: '#5a7a3a', fontWeight: '600', marginTop: 4 },
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
  cardLockedEmoji: { fontSize: 24, marginRight: 14, width: 28 },
  cardTitleLocked: { fontSize: 15, fontWeight: '700', color: '#8a8a7a' },
  cardUnlockHint: { fontSize: 12, color: '#b0b0a0', marginTop: 4 },

  bottomPad: { height: 32 },
});
