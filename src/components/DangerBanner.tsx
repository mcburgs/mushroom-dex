import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DangerBannerProps {
  warnings?: string[];
  title?: string;
  message?: string;
}

export default function DangerBanner({ warnings, title, message }: DangerBannerProps) {
  // Message mode: show a single message with a custom title
  if (message) {
    return (
      <View style={styles.banner}>
        <Text style={styles.title}>{title ?? '⚠️ Warning'}</Text>
        <Text style={styles.body}>{message}</Text>
      </View>
    );
  }

  // Warnings list mode (original behaviour)
  if (!warnings || warnings.length === 0) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{title ?? '⚠️ Lookalike Warning'}</Text>
      {warnings.map((warning, index) => (
        <View key={`${warning}-${index}`} style={[styles.item, index > 0 && styles.divider]}>
          <Text style={styles.body}>{warning}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff0f0',
    borderLeftWidth: 8,
    borderLeftColor: '#8b1a1a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#8b1a1a', marginBottom: 8 },
  item: { paddingTop: 2 },
  divider: { borderTopWidth: 1, borderTopColor: '#f3cccc', marginTop: 8, paddingTop: 8 },
  body: { fontSize: 13, color: '#5a2a2a', lineHeight: 19 },
});
