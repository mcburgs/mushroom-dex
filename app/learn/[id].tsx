import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProfile, getCachedProfile, completeLessonWithPoints } from '../../src/storage/userProfile';
import { LearnLesson, QuizQuestion } from '../../src/types';
import { CAT_EMOJI, CAT_BADGE_COLORS } from '../../src/constants/lessonCategories';
import QuizRenderer from '../../src/components/learn/QuizRenderer';
import lessonsData from '../../data/lessons.json';

const LESSON_POINTS = 20;

type LessonPhase = 'reading' | 'quiz' | 'done';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const lesson = (lessonsData as unknown as LearnLesson[]).find((l) => l.id === id);

  const [phase, setPhase] = useState<LessonPhase>('reading');
  const [quizStep, setQuizStep] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [finishingQuiz, setFinishingQuiz] = useState(false);
  const [awardedThisRun, setAwardedThisRun] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Synchronous cache read — instant, no network round-trip
      const cached = getCachedProfile();
      if (cached) setAlreadyDone(cached.completedLessons.includes(id ?? ''));

      // Background async refresh from Firestore
      getUserProfile({ force: true }).then((p) => {
        if (active) setAlreadyDone(p.completedLessons.includes(id ?? ''));
      });

      return () => { active = false; };
    }, [id])
  );

  if (!lesson) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Lesson not found.</Text>
      </View>
    );
  }

  const questions = lesson.quizQuestions;
  const lessonId = lesson.id;
  const currentQuestion: QuizQuestion | undefined = questions[quizStep];
  const catEmoji = CAT_EMOJI[lesson.cat] ?? '📖';
  const [catBg, catFg] = CAT_BADGE_COLORS[lesson.cat] ?? ['#f1efe8', '#444'];

  if (!currentQuestion) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>This lesson has no quiz questions yet.</Text>
      </View>
    );
  }

  function startQuiz() {
    setQuizStep(0);
    setAnswered(false);
    setCorrectCount(0);
    setAwardedThisRun(false);
    setPhase('quiz');
  }

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    if (correct) setCorrectCount((c) => c + 1);
  }

  async function handleNext() {
    if (finishingQuiz) return;
    setFinishingQuiz(true);
    if (quizStep < questions.length - 1) {
      setQuizStep((s) => s + 1);
      setAnswered(false);
      setFinishingQuiz(false);
      return;
    }

    if (alreadyDone) {
      setAwardedThisRun(false);
      setPhase('done');
      setFinishingQuiz(false);
      return;
    }

    try {
      const { awarded } = await completeLessonWithPoints(lessonId, LESSON_POINTS);
      setAlreadyDone(true);
      setAwardedThisRun(awarded);
      setPhase('done');
    } catch (error) {
      console.warn('[Learn] Lesson completion failed:', error);
      Alert.alert(
        'Could not finish lesson',
        'Your completion could not be saved yet. Please tap "See Results" again.',
      );
    } finally {
      setFinishingQuiz(false);
    }
  }

  // ─── READING phase ────────────────────────────────────────────────────────

  if (phase === 'reading') {
    const paragraphs = lesson.body.split('\n\n');
    const heroImage = lesson.images[0];

    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Category badge */}
          <View style={[styles.topicChip, { backgroundColor: catBg }]}>
            <Text style={[styles.topicChipText, { color: catFg }]}>
              {catEmoji + ' ' + lesson.cat}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.lessonTitle}>{lesson.title}</Text>

          {/* Hero image */}
          {heroImage && (
            <View style={styles.heroContainer}>
              <Image source={{ uri: heroImage.url }} style={styles.heroImage} />
              {heroImage.caption ? (
                <Text style={styles.heroCaption}>{heroImage.caption}</Text>
              ) : null}
            </View>
          )}

          {/* Summary callout */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{lesson.summary}</Text>
          </View>

          {/* Body */}
          <View style={styles.bodyCard}>
            {paragraphs.map((para, i) => (
              <Text key={i} style={[styles.bodyText, i > 0 && styles.bodyTextSpaced]}>
                {para}
              </Text>
            ))}
          </View>

          {/* Already completed note */}
          {alreadyDone && (
            <View style={styles.completedNote}>
              <Text style={styles.completedNoteText}>
                ✓ You have completed this lesson. Retake the quiz any time — points are awarded once.
              </Text>
            </View>
          )}

          {/* Quiz CTA */}
          <TouchableOpacity style={styles.quizButton} onPress={startQuiz}>
            <Text style={styles.quizButtonText}>
              {alreadyDone ? 'Retake Quiz 🎯' : 'Take the Quiz 🎯'}
            </Text>
            {!alreadyDone && (
              <Text style={styles.quizButtonSub}>{'+' + LESSON_POINTS + ' pts · first completion'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── QUIZ phase ───────────────────────────────────────────────────────────

  if (phase === 'quiz') {
    const progress = Math.round(((quizStep + 1) / questions.length) * 100);

    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Quiz header */}
        <View style={styles.quizBar}>
          <TouchableOpacity
            onPress={() => { if (!finishingQuiz) setPhase('reading'); }}
            style={styles.quizBack}
            disabled={finishingQuiz}
          >
            <Text style={styles.quizBackText}>{'‹ Lesson'}</Text>
          </TouchableOpacity>
          <View style={styles.quizCenter}>
            <Text style={styles.quizStepLabel}>
              {'Question ' + (quizStep + 1) + ' of ' + questions.length}
            </Text>
            <View style={styles.quizProgressBar}>
              <View style={[styles.quizProgressFill, { width: `${progress}%` }]} />
            </View>
          </View>
          <View style={styles.quizRight} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <QuizRenderer
            key={quizStep}
            question={currentQuestion}
            onAnswer={handleAnswer}
          />

          {answered && (
            <TouchableOpacity
              style={[styles.nextButton, finishingQuiz && styles.nextButtonDisabled]}
              onPress={() => { void handleNext(); }}
              disabled={finishingQuiz}
            >
              {finishingQuiz ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {quizStep < questions.length - 1 ? 'Next Question →' : 'See Results →'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── DONE phase ───────────────────────────────────────────────────────────

  const perfect = correctCount === questions.length;
  const scorePercent = Math.round((correctCount / questions.length) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.resultBanner}>
          <Text style={styles.resultEmoji}>{perfect ? '🏆' : '🎯'}</Text>
          <Text style={styles.resultScore}>
            {correctCount + ' / ' + questions.length + ' correct'}
          </Text>
          <Text style={styles.resultPercent}>{scorePercent + '%'}</Text>
        </View>

        {awardedThisRun ? (
          <View style={styles.pointsBanner}>
            <Text style={styles.pointsBannerText}>{'+' + LESSON_POINTS + ' points earned!'}</Text>
          </View>
        ) : (
          <View style={styles.pointsBannerAlt}>
            <Text style={styles.pointsBannerAltText}>Lesson already completed — no extra points.</Text>
          </View>
        )}

        {perfect && (
          <Text style={styles.perfectText}>
            Perfect score! You know this topic well.
          </Text>
        )}
        {!perfect && correctCount >= Math.ceil(questions.length / 2) && (
          <Text style={styles.goodText}>
            Good effort! Read the lesson again to strengthen the tricky parts.
          </Text>
        )}
        {correctCount < Math.ceil(questions.length / 2) && (
          <Text style={styles.tryAgainText}>
            Keep practising — re-read the lesson and try again!
          </Text>
        )}

        <TouchableOpacity style={styles.retakeButton} onPress={startQuiz} disabled={finishingQuiz}>
          <Text style={styles.retakeButtonText}>Retake Quiz</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => { if (!finishingQuiz) router.back(); }} disabled={finishingQuiz}>
          <Text style={styles.backButtonText}>Back to Lessons</Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: '#8a8a7a' },

  // Reading phase
  topicChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  topicChipText: { fontSize: 13, fontWeight: '600' },
  lessonTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2d4a1a',
    lineHeight: 32,
    marginBottom: 12,
  },
  heroContainer: { marginBottom: 14 },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: '#e8e8d8',
  },
  heroCaption: { fontSize: 12, color: '#8a8a7a', marginTop: 4, textAlign: 'center' },
  summaryBox: {
    backgroundColor: '#e8f5d8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5a7a3a',
  },
  summaryText: { fontSize: 14, color: '#2d4a1a', lineHeight: 20, fontStyle: 'italic' },
  bodyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8d8',
    padding: 18,
    marginBottom: 16,
  },
  bodyText: { fontSize: 15, color: '#3a3a2a', lineHeight: 23 },
  bodyTextSpaced: { marginTop: 14 },
  completedNote: {
    backgroundColor: '#e8f5d8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  completedNoteText: { fontSize: 13, color: '#2d4a1a', lineHeight: 18 },
  quizButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  quizButtonText: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  quizButtonSub: { fontSize: 13, color: '#c8e8a8', marginTop: 4, textAlign: 'center' },

  // Quiz bar
  quizBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
    backgroundColor: '#f9f6f0',
  },
  quizBack: { minWidth: 70, paddingVertical: 4 },
  quizBackText: { fontSize: 15, color: '#5a7a3a', fontWeight: '600' },
  quizCenter: { flex: 1, alignItems: 'center' },
  quizStepLabel: { fontSize: 12, color: '#8a8a7a', marginBottom: 4 },
  quizProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8f5d8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  quizProgressFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 3 },
  quizRight: { minWidth: 70 },

  // Next button
  nextButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  nextButtonDisabled: { opacity: 0.7 },
  nextButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Done / result phase
  resultBanner: {
    backgroundColor: '#2d4a1a',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 12,
  },
  resultEmoji: { fontSize: 48, marginBottom: 8 },
  resultScore: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  resultPercent: { fontSize: 36, fontWeight: '800', color: '#a8d878' },
  pointsBanner: {
    backgroundColor: '#e8f5d8',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsBannerText: { fontSize: 17, fontWeight: '700', color: '#2d4a1a' },
  pointsBannerAlt: {
    backgroundColor: '#f4f4ec',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  pointsBannerAltText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center' },
  perfectText: {
    fontSize: 16,
    color: '#2d4a1a',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  goodText: {
    fontSize: 15,
    color: '#5a5a4a',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  tryAgainText: {
    fontSize: 15,
    color: '#5a5a4a',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retakeButton: {
    borderWidth: 2,
    borderColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  retakeButtonText: { fontSize: 16, fontWeight: '700', color: '#5a7a3a' },
  backButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  bottomPad: { height: 32 },
});

