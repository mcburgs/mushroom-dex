import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WeatherSnapshot } from '../utils/forecastEngine';

function conditionColor(label: string) {
  if (label.includes('Excellent')) return '#5a7a3a';
  if (label.includes('Good')) return '#8b6914';
  if (label.includes('Poor') || label.includes('unavailable')) return '#8b1a1a';
  return '#8a8a7a';
}

export default function ForecastCard({
  weather,
  seasonLabel,
  dateLabel,
  fieldTip,
}: {
  weather: WeatherSnapshot;
  seasonLabel: string;
  dateLabel: string;
  fieldTip: string;
}) {
  const accent = conditionColor(weather.conditionLabel);
  return (
    <View style={styles.card}>
      <Text style={[styles.condition, { color: accent }]}>{weather.conditionLabel}</Text>
      <Text style={styles.summary}>{weather.weatherSummary}</Text>
      <Text style={styles.season}>{seasonLabel} · {dateLabel}</Text>
      <Text style={styles.tip}>{fieldTip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 14,
  },
  condition: { fontSize: 22, fontWeight: '800' },
  summary: { fontSize: 14, color: '#5a5a4a', marginTop: 6 },
  season: { fontSize: 13, color: '#8a8a7a', marginTop: 10, fontWeight: '600' },
  tip: { fontSize: 14, color: '#2d4a1a', marginTop: 12, lineHeight: 20 },
});
