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
import { MysteryObservation } from '../../src/types';
import { getMysteryLogs, getCachedMysteryLogs } from '../../src/storage/mysteryLogs';
import { COLOR_OPTS, FORM_OPTS, optionLabel } from '../../src/constants/fieldId';

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MysteryScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<MysteryObservation[]>([]);
  const activeReviewCount = logs.filter((l) => l.reviewStatus === 'active').length;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const cm = getCachedMysteryLogs();
      if (cm) setLogs(cm);
      getMysteryLogs({ force: true }).then((l) => { if (active) setLogs(l); });
      return () => { active = false; };
    }, [])
  );

  function startWizard() {
    router.push({ pathname: '/trail/field-id', params: { fromTrail: '0' } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Mystery Finder</Text>
        <Text style={styles.subtitle}>
          Guided field observation{activeReviewCount > 0 ? ` • ${activeReviewCount} active review${activeReviewCount > 1 ? 's' : ''}` : ''}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Start button */}
        <TouchableOpacity style={styles.startButton} onPress={startWizard}>
          <Text style={styles.startEmoji}>🔍</Text>
          <View style={styles.startInfo}>
            <Text style={styles.startTitle}>New Mystery Observation</Text>
            <Text style={styles.startSub}>Start live Field ID and log the result</Text>
          </View>
          <Text style={styles.startArrow}>{'›'}</Text>
        </TouchableOpacity>

        {/* Past logs */}
        {logs.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Past Observations</Text>
            {logs
              .slice()
              .sort((a, b) => {
                const aActive = a.reviewStatus === 'active' ? 1 : 0;
                const bActive = b.reviewStatus === 'active' ? 1 : 0;
                if (aActive !== bActive) return bActive - aActive;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
              })
              .map((log) => {
              const formLabel = optionLabel(FORM_OPTS, log.overallForm) || log.likelyBroadType;
              const colorLabel = optionLabel(COLOR_OPTS, log.colorPrimary) || log.colorPrimary;
              return (
                <View key={log.id} style={styles.logCard}>
                  {log.photos.length > 0 && (
                    <Image
                      source={{ uri: log.photos[0] }}
                      style={styles.logPhoto}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.logBody}>
                    <Text style={styles.logDate}>
                      {new Date(log.date).toLocaleDateString('en-CA', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <View style={styles.logChipRow}>
                      {log.reviewStatus === 'active' ? (
                        <Text style={styles.logChipActive}>Active Review</Text>
                      ) : null}
                      {formLabel ? (
                        <Text style={styles.logChip}>{formLabel}</Text>
                      ) : null}
                      {colorLabel ? (
                        <Text style={styles.logChip}>{colorLabel}</Text>
                      ) : null}
                    </View>
                    {log.locationNote ? (
                      <Text style={styles.logLocation} numberOfLines={1}>
                        {'📍 ' + log.locationNote}
                      </Text>
                    ) : null}
                    {log.suggestedMushroomIds.length > 0 ? (
                      <Text style={styles.logMatches}>
                        {log.suggestedMushroomIds.length +
                          ' possible match' +
                          (log.suggestedMushroomIds.length === 1 ? '' : 'es') +
                          ' in Dex'}
                      </Text>
                    ) : (
                      <Text style={styles.logNoMatch}>No close matches found</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No observations yet</Text>
            <Text style={styles.emptyText}>
              Found something mysterious? Start an observation above and earn points!
            </Text>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { padding: 16 },

  // List header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },

  // Start button
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5a7a3a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  startEmoji: { fontSize: 32, marginRight: 14 },
  startInfo: { flex: 1, minWidth: 0 },
  startTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  startSub: { fontSize: 13, color: '#c8e8a8', marginTop: 2, flexShrink: 1 },
  startArrow: { fontSize: 28, color: '#fff', marginLeft: 8 },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#2d4a1a', marginBottom: 10 },

  // Log cards
  logCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginBottom: 10,
    overflow: 'hidden',
  },
  logPhoto: { width: 80, height: 80 },
  logBody: { flex: 1, padding: 12 },
  logDate: { fontSize: 12, color: '#8a8a7a', marginBottom: 4 },
  logChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  logChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    color: '#2d4a1a',
    fontWeight: '600',
    marginRight: 6,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  logChipActive: {
    backgroundColor: '#fff4cc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    color: '#7a5a00',
    fontWeight: '700',
    marginRight: 6,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  logLocation: { fontSize: 12, color: '#5a5a4a', marginBottom: 2 },
  logMatches: { fontSize: 12, color: '#5a7a3a', fontWeight: '600' },
  logNoMatch: { fontSize: 12, color: '#8a8a7a' },

  // Empty state
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2d4a1a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', lineHeight: 20 },

  bottomPad: { height: 40 },
});
