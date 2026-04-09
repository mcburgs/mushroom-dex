import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProfile, markLessonComplete, addPoints } from '../../src/storage/userProfile';
import lessonsData from '../../data/lessons.json';

const LESSON_POINTS = 20;

const TOPIC_EMOJI: Record<string, string> = {
  'Fungi Basics': '🧫',
  'Stay Safe': '⚠️',
  'Broad Types': '🍄',
  'Morphology': '🔬',
  'Habitat': '🌲',
  'Field Observation': '👁️',
  'Advanced ID': '🔭',
};

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Lesson {
  id: string;
  title: string;
  topic: string;
  unlockTier: string;
  body: string;
  quizQuestions: QuizQuestion[];
}

type LessonPhase = 'reading' | 'quiz' | 'done';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const lesson = (lessonsData as Lesson[]).find((l) => l.id === id);

  const [phase, setPhase] = useState<LessonPhase>('reading');
  const [quizStep, setQuizStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserProfile().then((p) => {
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
  const currentQuestion = questions[quizStep];
  const topicEmoji = TOPIC_EMOJI[lesson.topic] ?? '📖';

  function startQuiz() {
    setQuizStep(0);
    setSelected(null);
    setAnswered(false);
    setCorrectCount(0);
    setPhase('quiz');
  }

  function handleAnswer(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === currentQuestion.correctIndex) {
      setCorrectCount((c) => c + 1);
    }
  }

  async function handleNext() {
    if (quizStep < questions.length - 1) {
      setQuizStep((s) => s + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      // Quiz complete
      setPhase('done');
      if (!alreadyDone) {
        await markLessonComplete(lesson.id);
        await addPoints(LESSON_POINTS);
        setAlreadyDone(true);
      }
    }
  }

  // ─── READING phase ────────────────────────────────────────────────────────

  if (phase === 'reading') {
    const paragraphs = lesson.body.split('\n\n');
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Topic chip */}
          <View style={styles.topicChip}>
            <Text style={styles.topicChipText}>{topicEmoji + ' ' + lesson.topic + ' '}</Text>
          </View>

          {/* Title */}
          <Text style={styles.lessonTitle}>{lesson.title}</Text>

          {/* Tier badge */}
          <Text style={styles.tierLabel}>
            {'Unlocks at: ' + lesson.unlockTier + ' '}
          </Text>

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
                {'✓ You have completed this lesson. Retake the quiz any time — points are awarded once.'}
              </Text>
            </View>
          )}

          {/* Quiz CTA */}
          <TouchableOpacity style={styles.quizButton} onPress={startQuiz}>
            <Text style={styles.quizButtonText}>
              {alreadyDone ? 'Retake Quiz 🎯' : 'Take the Quiz 🎯'}
            </Text>
            {!alreadyDone && (
              <Text style={styles.quizButtonSub}>{'+' + LESSON_POINTS + ' points on completion '}</Text>
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
          <TouchableOpacity onPress={() => setPhase('reading')} style={styles.quizBack}>
            <Text style={styles.quizBackText}>{'‹ Lesson '}</Text>
          </TouchableOpacity>
          <View style={styles.quizCenter}>
            <Text style={styles.quizStepLabel}>
              {'Question ' + (quizStep + 1) + ' of ' + questions.length + ' '}
            </Text>
            <View style={styles.quizProgressBar}>
              <View style={[styles.quizProgressFill, { width: `${progress}%` }]} />
            </View>
          </View>
          <View style={styles.quizRight} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          <View style={styles.optionsList}>
            {currentQuestion.options.map((opt, idx) => {
              let optStyle = styles.option;
              let textStyle = styles.optionText;

              if (answered) {
                if (idx === currentQuestion.correctIndex) {
                  optStyle = StyleSheet.flatten([styles.option, styles.optionCorrect]);
                  textStyle = StyleSheet.flatten([styles.optionText, styles.optionTextLight]);
                } else if (idx === selected) {
                  optStyle = StyleSheet.flatten([styles.option, styles.optionWrong]);
                  textStyle = StyleSheet.flatten([styles.optionText, styles.optionTextLight]);
                }
              } else if (idx === selected) {
                optStyle = StyleSheet.flatten([styles.option, styles.optionSelected]);
                textStyle = StyleSheet.flatten([styles.optionText, styles.optionTextLight]);
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={optStyle}
                  onPress={() => handleAnswer(idx)}
                  disabled={answered}
                >
                  <View style={styles.optionLetter}>
                    <Text style={styles.optionLetterText}>
                      {String.fromCharCode(65 + idx)}
                    </Text>
                  </View>
                  <Text style={textStyle}>{opt + ' '}</Text>
                  {answered && idx === currentQuestion.correctIndex && (
                    <Text style={styles.optionCheckmark}>✓</Text>
                  )}
                  {answered && idx === selected && idx !== currentQuestion.correctIndex && (
                    <Text style={styles.optionCross}>✕</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation */}
          {answered && (
            <View style={[
              styles.explanationBox,
              selected === currentQuestion.correctIndex ? styles.explanationCorrect : styles.explanationWrong,
            ]}>
              <Text style={styles.explanationResult}>
                {selected === currentQuestion.correctIndex ? '✓ Correct! ' : '✕ Not quite. '}
              </Text>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
            </View>
          )}

          {answered && (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {quizStep < questions.length - 1 ? 'Next Question →' : 'See Results →'}
              </Text>
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
            {correctCount + ' / ' + questions.length + ' correct '}
          </Text>
          <Text style={styles.resultPercent}>{scorePercent + '%'}</Text>
        </View>

        {!alreadyDone ? (
          <View style={styles.pointsBanner}>
            <Text style={styles.pointsBannerText}>{'+' + LESSON_POINTS + ' points earned! '}</Text>
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

        <TouchableOpacity style={styles.retakeButton} onPress={startQuiz}>
          <Text style={styles.retakeButtonText}>Retake Quiz</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  topicChipText: { fontSize: 13, color: '#2d4a1a', fontWeight: '600' },
  lessonTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2d4a1a',
    lineHeight: 32,
    marginBottom: 6,
  },
  tierLabel: { fontSize: 13, color: '#8a8a7a', marginBottom: 16 },
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
    alignItems: 'center',
  },
  quizButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  quizButtonSub: { fontSize: 13, color: '#c8e8a8', marginTop: 4 },

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

  // Quiz question
  questionText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#2d4a1a',
    lineHeight: 26,
    marginBottom: 20,
  },
  optionsList: {},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  optionSelected: {
    backgroundColor: '#3a6a8a',
    borderColor: '#3a6a8a',
  },
  optionCorrect: {
    backgroundColor: '#5a7a3a',
    borderColor: '#5a7a3a',
  },
  optionWrong: {
    backgroundColor: '#8b3a14',
    borderColor: '#8b3a14',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionLetterText: { fontSize: 13, fontWeight: '700', color: '#2d4a1a' },
  optionText: { flex: 1, fontSize: 15, color: '#2d4a1a', fontWeight: '500' },
  optionTextLight: { color: '#fff' },
  optionCheckmark: { fontSize: 16, color: '#fff', fontWeight: '700', marginLeft: 8 },
  optionCross: { fontSize: 16, color: '#fff', fontWeight: '700', marginLeft: 8 },

  // Explanation
  explanationBox: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    marginTop: 4,
  },
  explanationCorrect: { backgroundColor: '#e8f5d8', borderWidth: 1, borderColor: '#b8d898' },
  explanationWrong: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#f0c8a0' },
  explanationResult: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 6 },
  explanationText: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },

  nextButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
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
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsBannerAltText: { fontSize: 14, color: '#8a8a7a' },
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
