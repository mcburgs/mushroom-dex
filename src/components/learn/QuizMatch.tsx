import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MatchQuestion } from '../../types';

interface Props {
  question: MatchQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function QuizMatch({ question, onAnswer }: Props) {
  const terms = question.pairs.map((p) => p.term);

  // Shuffle INDICES, not strings — preserves 1-to-1 mapping even if definition text is identical
  const shuffledPairIndices = useMemo(() => {
    const indices = question.pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [question]);

  // matches: termIdx -> shuffled-slot index (not pair index)
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({}); // termIdx -> slotIdx
  const [submitted, setSubmitted] = useState(false);

  // For each shuffled slot, what pair index lives there?
  // shuffledPairIndices[slotIdx] = pairIdx
  // So the correct slot for termIdx ti is: the slot where shuffledPairIndices[slot] === ti
  const correctSlotForTerm = useMemo(() => {
    const m: Record<number, number> = {};
    question.pairs.forEach((_, pairIdx) => {
      const slot = shuffledPairIndices.indexOf(pairIdx);
      m[pairIdx] = slot;
    });
    return m;
  }, [question, shuffledPairIndices]);

  const matchedSlots = new Set(Object.values(matches));

  function handleTermTap(ti: number) {
    if (submitted) return;
    if (matches[ti] !== undefined) {
      // Tap again to undo
      const next = { ...matches };
      delete next[ti];
      setMatches(next);
      setSelectedTerm(null);
      return;
    }
    setSelectedTerm(ti);
  }

  function handleDefTap(slotIdx: number) {
    if (submitted || selectedTerm === null || matchedSlots.has(slotIdx)) return;
    const next = { ...matches, [selectedTerm]: slotIdx };
    setMatches(next);
    setSelectedTerm(null);

    if (Object.keys(next).length === terms.length) {
      setSubmitted(true);
      const allCorrect = terms.every((_, ti) => next[ti] === correctSlotForTerm[ti]);
      onAnswer(allCorrect);
    }
  }

  const allCorrect = submitted && terms.every((_, ti) => matches[ti] === correctSlotForTerm[ti]);

  return (
    <View>
      <Text style={styles.instruction}>{question.instruction}</Text>
      <Text style={styles.hint}>Tap a term, then tap its match.</Text>

      <View style={styles.columns}>
        {/* Left column — terms (fixed order) */}
        <View style={styles.col}>
          {terms.map((t, ti) => {
            const paired = matches[ti] !== undefined;
            const isCorrectPair = submitted && matches[ti] === correctSlotForTerm[ti];
            const isWrongPair = submitted && paired && !isCorrectPair;
            return (
              <TouchableOpacity
                key={ti}
                style={[
                  styles.chip,
                  selectedTerm === ti && styles.chipActive,
                  isCorrectPair && styles.chipCorrect,
                  isWrongPair && styles.chipWrong,
                  paired && !submitted && styles.chipPaired,
                ]}
                onPress={() => handleTermTap(ti)}
                disabled={submitted}
              >
                <Text style={[
                  styles.chipText,
                  (selectedTerm === ti || isCorrectPair || isWrongPair || (paired && !submitted)) && styles.chipTextLight,
                ]}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right column — definitions (shuffled) */}
        <View style={styles.col}>
          {shuffledPairIndices.map((pairIdx, slotIdx) => {
            const def = question.pairs[pairIdx].definition;
            const taken = matchedSlots.has(slotIdx);
            const pairedTermIdx = Object.entries(matches).find(([, v]) => v === slotIdx)?.[0];
            const isCorrectPair = submitted && pairedTermIdx !== undefined && correctSlotForTerm[Number(pairedTermIdx)] === slotIdx;
            const isWrongPair = submitted && taken && !isCorrectPair;
            return (
              <TouchableOpacity
                key={slotIdx}
                style={[
                  styles.chip,
                  taken && !submitted && styles.chipPaired,
                  isCorrectPair && styles.chipCorrect,
                  isWrongPair && styles.chipWrong,
                ]}
                onPress={() => handleDefTap(slotIdx)}
                disabled={submitted || taken || selectedTerm === null}
              >
                <Text style={[
                  styles.chipText,
                  taken && !submitted && styles.chipTextLight,
                  (isCorrectPair || isWrongPair) && styles.chipTextLight,
                ]}>
                  {def}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {submitted && (
        <View style={[styles.explanation, allCorrect ? styles.explanationCorrect : styles.explanationWrong]}>
          <Text style={styles.explanationResult}>
            {allCorrect ? '✓ All matched correctly!' : '✕ Some pairs were wrong.'}
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
  columns: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  col: { flex: 1, gap: 8 },
  chip: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d4e8b8',
    paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center',
  },
  chipActive: { backgroundColor: '#3a6a8a', borderColor: '#3a6a8a' },
  chipPaired: { backgroundColor: '#6a8aaa', borderColor: '#6a8aaa' },
  chipCorrect: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  chipWrong: { backgroundColor: '#8b3a14', borderColor: '#8b3a14' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#2d4a1a', textAlign: 'center' },
  chipTextLight: { color: '#fff' },
  explanation: { borderRadius: 14, padding: 14, marginBottom: 14, marginTop: 4 },
  explanationCorrect: { backgroundColor: '#e8f5d8', borderWidth: 1, borderColor: '#b8d898' },
  explanationWrong: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#f0c8a0' },
  explanationResult: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 6 },
  explanationText: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },
});
