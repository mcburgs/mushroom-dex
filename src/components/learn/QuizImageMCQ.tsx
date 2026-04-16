import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { ImageMCQQuestion } from '../../types';

interface Props {
  question: ImageMCQQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function QuizImageMCQ({ question, onAnswer }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  function handleTap(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    onAnswer(idx === question.correctIndex);
  }

  return (
    <View>
      <Image source={{ uri: question.imageUrl }} style={styles.image} />
      {question.imageCaption ? (
        <Text style={styles.caption}>{question.imageCaption}</Text>
      ) : null}

      <Text style={styles.questionText}>{question.question}</Text>

      <View style={styles.optionsList}>
        {question.options.map((opt, idx) => {
          const isCorrect = answered && idx === question.correctIndex;
          const isWrong = answered && idx === selected && idx !== question.correctIndex;
          const isSelected = !answered && idx === selected;
          const lightText = isCorrect || isWrong || isSelected;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.option,
                isCorrect && styles.optionCorrect,
                isWrong && styles.optionWrong,
                isSelected && styles.optionSelected,
              ]}
              onPress={() => handleTap(idx)}
              disabled={answered}
            >
              <View style={styles.optionLetter}>
                <Text style={styles.optionLetterText}>
                  {String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={[styles.optionText, lightText && styles.optionTextLight]}>
                {opt}
              </Text>
              {isCorrect && <Text style={styles.mark}>✓</Text>}
              {isWrong && <Text style={styles.mark}>✕</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {answered && (
        <View style={[styles.explanation, selected === question.correctIndex ? styles.explanationCorrect : styles.explanationWrong]}>
          <Text style={styles.explanationResult}>
            {selected === question.correctIndex ? '✓ Correct!' : '✕ Not quite.'}
          </Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 6, backgroundColor: '#e8e8d8' },
  caption: { fontSize: 12, color: '#8a8a7a', marginBottom: 16, textAlign: 'center' },
  questionText: { fontSize: 19, fontWeight: '700', color: '#2d4a1a', lineHeight: 26, marginBottom: 20 },
  optionsList: {},
  option: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#d4e8b8',
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10,
  },
  optionSelected: { backgroundColor: '#3a6a8a', borderColor: '#3a6a8a' },
  optionCorrect: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  optionWrong: { backgroundColor: '#8b3a14', borderColor: '#8b3a14' },
  optionLetter: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  optionLetterText: { fontSize: 13, fontWeight: '700', color: '#2d4a1a' },
  optionText: { flex: 1, fontSize: 15, color: '#2d4a1a', fontWeight: '500' },
  optionTextLight: { color: '#fff' },
  mark: { fontSize: 16, color: '#fff', fontWeight: '700', marginLeft: 8 },
  explanation: { borderRadius: 14, padding: 14, marginBottom: 14, marginTop: 4 },
  explanationCorrect: { backgroundColor: '#e8f5d8', borderWidth: 1, borderColor: '#b8d898' },
  explanationWrong: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#f0c8a0' },
  explanationResult: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 6 },
  explanationText: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },
});
