import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SequenceQuestion } from '../../types';

interface Props {
  question: SequenceQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function QuizSequence({ question, onAnswer }: Props) {
  const shuffled = useMemo(() => {
    const arr = question.items.map((item, correctIdx) => ({ item, correctIdx }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [question]);

  const [order, setOrder] = useState<number[]>([]); // indices into shuffled
  const [submitted, setSubmitted] = useState(false);

  function handleTap(idx: number) {
    if (submitted) return;
    if (order.includes(idx)) {
      setOrder(order.filter((i) => i !== idx));
      return;
    }
    const next = [...order, idx];
    setOrder(next);

    if (next.length === shuffled.length) {
      setSubmitted(true);
      const isCorrect = next.every((si, pos) => shuffled[si].correctIdx === pos);
      onAnswer(isCorrect);
    }
  }

  const allCorrect = submitted && order.every((si, pos) => shuffled[si].correctIdx === pos);

  return (
    <View>
      <Text style={styles.instruction}>{question.instruction}</Text>
      <Text style={styles.hint}>Tap items in the correct order. Tap again to undo.</Text>

      <View style={styles.items}>
        {shuffled.map((entry, idx) => {
          const pos = order.indexOf(idx);
          const picked = pos !== -1;
          const isCorrectPos = submitted && picked && shuffled[order[pos]].correctIdx === pos;
          const isWrongPos = submitted && picked && !isCorrectPos;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.item,
                picked && !submitted && styles.itemPicked,
                isCorrectPos && styles.itemCorrect,
                isWrongPos && styles.itemWrong,
              ]}
              onPress={() => handleTap(idx)}
              disabled={submitted}
            >
              {picked && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pos + 1}</Text>
                </View>
              )}
              <Text style={[
                styles.itemText,
                (picked && !submitted) && styles.itemTextLight,
                (isCorrectPos || isWrongPos) && styles.itemTextLight,
              ]}>
                {entry.item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {submitted && (
        <View style={[styles.explanation, allCorrect ? styles.explanationCorrect : styles.explanationWrong]}>
          <Text style={styles.explanationResult}>
            {allCorrect ? '✓ Perfect order!' : '✕ Not quite right.'}
          </Text>
          <Text style={styles.correctOrder}>
            {'Correct order: ' + question.items.join(' → ')}
          </Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  instruction: { fontSize: 19, fontWeight: '700', color: '#2d4a1a', lineHeight: 26, marginBottom: 6 },
  hint: { fontSize: 13, color: '#8a8a7a', marginBottom: 16 },
  items: { gap: 10, marginBottom: 14 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#d4e8b8',
    paddingVertical: 14, paddingHorizontal: 14,
  },
  itemPicked: { backgroundColor: '#3a6a8a', borderColor: '#3a6a8a' },
  itemCorrect: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  itemWrong: { backgroundColor: '#8b3a14', borderColor: '#8b3a14' },
  itemText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#2d4a1a' },
  itemTextLight: { color: '#fff' },
  badge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  explanation: { borderRadius: 14, padding: 14, marginBottom: 14, marginTop: 4 },
  explanationCorrect: { backgroundColor: '#e8f5d8', borderWidth: 1, borderColor: '#b8d898' },
  explanationWrong: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#f0c8a0' },
  explanationResult: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 6 },
  correctOrder: { fontSize: 13, fontWeight: '600', color: '#5a5a4a', marginBottom: 6 },
  explanationText: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },
});
