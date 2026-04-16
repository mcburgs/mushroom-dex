import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrueFalseQuestion } from '../../types';

interface Props {
  question: TrueFalseQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function QuizTrueFalse({ question, onAnswer }: Props) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const [answered, setAnswered] = useState(false);

  function handleTap(value: boolean) {
    if (answered) return;
    setPicked(value);
    setAnswered(true);
    onAnswer(value === question.isTrue);
  }

  const correct = picked === question.isTrue;

  return (
    <View>
      <Text style={styles.statement}>{question.statement}</Text>
      <Text style={styles.prompt}>Is this statement true or false?</Text>

      <View style={styles.row}>
        {[true, false].map((val) => {
          const isThis = picked === val;
          const isCorrectAnswer = answered && val === question.isTrue;
          const isWrongPick = answered && isThis && !correct;
          return (
            <TouchableOpacity
              key={String(val)}
              style={[
                styles.btn,
                isCorrectAnswer && styles.btnCorrect,
                isWrongPick && styles.btnWrong,
                !answered && isThis && styles.btnSelected,
              ]}
              onPress={() => handleTap(val)}
              disabled={answered}
            >
              <Text style={[
                styles.btnText,
                (isCorrectAnswer || isWrongPick || (!answered && isThis)) && styles.btnTextLight,
              ]}>
                {val ? 'TRUE' : 'FALSE'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {answered && (
        <View style={[styles.explanation, correct ? styles.explanationCorrect : styles.explanationWrong]}>
          <Text style={styles.explanationResult}>
            {correct ? '✓ Correct!' : '✕ Not quite.'}
          </Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statement: { fontSize: 19, fontWeight: '700', color: '#2d4a1a', lineHeight: 26, marginBottom: 8 },
  prompt: { fontSize: 14, color: '#8a8a7a', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  btn: {
    flex: 1, paddingVertical: 20, borderRadius: 14, borderWidth: 1,
    borderColor: '#d4e8b8', backgroundColor: '#fff', alignItems: 'center',
  },
  btnSelected: { backgroundColor: '#3a6a8a', borderColor: '#3a6a8a' },
  btnCorrect: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  btnWrong: { backgroundColor: '#8b3a14', borderColor: '#8b3a14' },
  btnText: { fontSize: 18, fontWeight: '800', color: '#2d4a1a' },
  btnTextLight: { color: '#fff' },
  explanation: { borderRadius: 14, padding: 14, marginBottom: 14, marginTop: 4 },
  explanationCorrect: { backgroundColor: '#e8f5d8', borderWidth: 1, borderColor: '#b8d898' },
  explanationWrong: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#f0c8a0' },
  explanationResult: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 6 },
  explanationText: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },
});
