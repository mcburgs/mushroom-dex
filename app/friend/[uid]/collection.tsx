import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import FindsList from '../../../src/components/FindsList';
import { getFriendFinds, getFriendProfile } from '../../../src/storage/friendData';
import { UserFind, UserProfile } from '../../../src/types';

const LEVEL_EMOJI: Record<string, string> = {
  'Explorer': '🌱',
  'Tracker': '👣',
  'Observer': '👁️',
  'Naturalist': '🌿',
  'Field Expert': '🍄',
  'Mycologist': '🔬',
  'Master Mycologist': '🏆',
};

export default function FriendCollectionScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    Promise.all([
      getFriendFinds(uid, { force: true }),
      getFriendProfile(uid),
    ]).then(([f, p]) => {
      setFinds(f);
      setProfile(p);
      setLoading(false);
    });
  }, [uid]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#5a7a3a" />
          <Text style={styles.loadingText}>Loading collection…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.name ?? 'Friend';

  const Header = (
    <View style={styles.headerCard}>
      <Text style={styles.headerName}>{displayName}'s Collection</Text>
      <Text style={styles.headerStats}>
        {LEVEL_EMOJI[profile?.level ?? 'Explorer'] ?? '🌱'}{' '}
        {profile?.level ?? 'Explorer'} · {finds.length} finds ·{' '}
        {profile?.totalPoints ?? 0} pts
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FindsList
        finds={finds}
        header={Header}
        showUserPhotos
        emptyText={`${displayName} hasn't found any mushrooms yet`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#8a8a7a', marginTop: 12 },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 4,
  },
  headerStats: { fontSize: 14, color: '#5a7a3a' },
});
