import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserFinds } from '../../src/storage/userFinds';
import { getUserProfile } from '../../src/storage/userProfile';
import { UserFind, UserProfile, MushroomEntry } from '../../src/types';
import mushroomData from '../../data/mushrooms.json';

export default function CollectionScreen() {
  const router = useRouter();
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserFinds().then((f) => { if (active) setFinds(f); });
      getUserProfile().then((p) => { if (active) setProfile(p); });
      return () => { active = false; };
    }, [])
  );

  const mushrooms = mushroomData as MushroomEntry[];

  const sortedFinds = [...finds].sort(
    (a, b) => new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime()
  );

  function getEntry(id: string) {
    return mushrooms.find((m) => m.id === id);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🗂️ My Collection</Text>
        <Text style={styles.subtitle}>
          {finds.length} of {mushrooms.length} found
        </Text>
      </View>

      {/* Points summary */}
      {profile && (
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>Total Points</Text>
          <Text style={styles.pointsValue}>{profile.totalPoints}</Text>
          <Text style={styles.stageLabel}>{profile.level}</Text>
        </View>
      )}

      {sortedFinds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>Nothing found yet!</Text>
          <Text style={styles.emptyText}>
            Head to the Dex and mark mushrooms as you find them in the wild.
          </Text>
          <TouchableOpacity
            style={styles.dexButton}
            onPress={() => router.push('/(tabs)/dex')}
          >
            <Text style={styles.dexButtonText}>Browse the Dex</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedFinds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const entry = getEntry(item.mushroomEntryId);
            if (!entry) return null;
            const heroImage = entry.images.find((img) => img.isHero);
            return (
              <TouchableOpacity
                style={styles.findCard}
                onPress={() => router.push(`/dex/${entry.id}`)}
              >
                <View style={styles.findImageContainer}>
                  {heroImage ? (
                    <Image
                      source={{ uri: heroImage.urlOrLocalPath }}
                      style={styles.findImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.findImagePlaceholder}>
                      <Text style={{ fontSize: 28 }}>🍄</Text>
                    </View>
                  )}
                </View>
                <View style={styles.findInfo}>
                  <Text style={styles.findName}>{entry.commonName}</Text>
                  <Text style={styles.findScientific}>{entry.scientificName}</Text>
                  <Text style={styles.findDate}>
                    Found{' '}
                    {new Date(item.dateFound).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  {item.userNotes ? (
                    <Text style={styles.findNotes} numberOfLines={2}>
                      {item.userNotes}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.findPoints}>+{entry.pointsValue}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#e8f5d8',
    gap: 8,
  },
  pointsLabel: { fontSize: 14, color: '#5a7a3a', flex: 1 },
  pointsValue: { fontSize: 20, fontWeight: '800', color: '#2d4a1a' },
  stageLabel: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: '#5a7a3a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontWeight: '600',
  },
  list: { padding: 16, gap: 10 },
  findCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d4e8b8',
    alignItems: 'center',
  },
  findImageContainer: { width: 80, height: 80, backgroundColor: '#e8f5d8' },
  findImage: { width: '100%', height: '100%' },
  findImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  findInfo: { flex: 1, padding: 12 },
  findName: { fontSize: 15, fontWeight: '700', color: '#2d4a1a' },
  findScientific: { fontSize: 12, fontStyle: 'italic', color: '#8a8a7a', marginTop: 1 },
  findDate: { fontSize: 12, color: '#5a7a3a', marginTop: 4 },
  findNotes: { fontSize: 12, color: '#8a8a7a', marginTop: 4, fontStyle: 'italic' },
  findPoints: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8b6914',
    paddingRight: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#2d4a1a', marginBottom: 10 },
  emptyText: {
    fontSize: 15,
    color: '#8a8a7a',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  dexButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  dexButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
