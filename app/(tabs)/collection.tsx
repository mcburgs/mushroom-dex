import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserFinds, getCachedFinds } from '../../src/storage/userFinds';
import { getUserProfile, getCachedProfile } from '../../src/storage/userProfile';
import { UserFind, UserProfile, MushroomEntry, BroadType } from '../../src/types';
import mushroomData from '../../data/mushrooms.json';
import FindsMap from '../../src/components/FindsMap';


const BROAD_TYPE_EMOJI: Record<string, string> = {
  'Gilled': '🍄',
  'Boletes/Pored': '🟤',
  'Bracket/Polypore': '🪵',
  'Puffball': '⚪',
  'Coral': '🌿',
  'Jelly': '🫧',
  'Cup': '🥣',
  'Tooth': '🦷',
  'Stinkhorn': '💥',
  'Crust': '📄',
  'Morel': '🔶',
  'Other': '❓',
};

const STAGE_EMOJI: Record<string, string> = {
  'Explorer': '🌱',
  'Tracker': '👣',
  'Observer': '👁️',
  'Naturalist': '🌿',
  'Field Expert': '🍄',
  'Mycologist': '🔬',
  'Master Mycologist': '🏆',
};

function CategoryProgress({
  type,
  found,
  total,
}: {
  type: BroadType;
  found: number;
  total: number;
}) {
  const pct = total > 0 ? found / total : 0;
  return (
    <View style={styles.catRow}>
      <Text style={styles.catEmoji}>{BROAD_TYPE_EMOJI[type] ?? '🍄'}</Text>
      <View style={styles.catInfo}>
        <View style={styles.catLabelRow}>
          <Text style={styles.catName}>{type + ' '}</Text>
          <Text style={styles.catCount}>{found}/{total}</Text>
        </View>
        <View style={styles.catBar}>
          <View style={[styles.catFill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

function FindCard({
  find,
  entry,
  onPress,
}: {
  find: UserFind;
  entry: MushroomEntry;
  onPress: () => void;
}) {
  const heroImage = entry.images.find((img) => img.isHero);
  const displayPhoto = find.userPhotoPaths?.[0] ?? heroImage?.urlOrLocalPath ?? null;

  return (
    <TouchableOpacity style={styles.findCard} onPress={onPress}>
      <View style={styles.findImageBox}>
        {displayPhoto ? (
          <Image source={{ uri: displayPhoto }} style={styles.findImage} resizeMode="cover" />
        ) : (
          <View style={styles.findImagePlaceholder}>
            <Text style={{ fontSize: 28 }}>🍄</Text>
          </View>
        )}
        {find.userPhotoPaths?.length > 0 && (
          <View style={styles.myPhotoFlag}>
            <Text style={styles.myPhotoFlagText}>📷</Text>
          </View>
        )}
      </View>
      <View style={styles.findInfo}>
        <Text style={styles.findName}>{entry.commonName}</Text>
        <Text style={styles.findScientific} numberOfLines={1}>{entry.scientificName}</Text>
        <Text style={styles.findDate}>
          {new Date(find.dateFound).toLocaleDateString('en-CA', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        {find.biomeTag ? (
          <Text style={styles.findBiome}>{find.biomeTag + ' '}</Text>
        ) : null}
        {find.locationNote ? (
          <Text style={styles.findLocation} numberOfLines={1}>
            {'📍 ' + find.locationNote}
          </Text>
        ) : null}
        {find.userNotes ? (
          <Text style={styles.findNotes} numberOfLines={2}>{find.userNotes}</Text>
        ) : null}
      </View>
      <Text style={styles.findPoints}>{'+' + entry.pointsValue}</Text>
    </TouchableOpacity>
  );
}

type Tab = 'finds' | 'notes' | 'map';

export default function CollectionScreen() {
  const router = useRouter();
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<Tab>('finds');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const cf = getCachedFinds(); const cp = getCachedProfile();
      if (cf) setFinds(cf);
      if (cp) setProfile(cp);
      getUserFinds({ force: true }).then((f) => {
        if (active) setFinds(f);
      });
      getUserProfile({ force: true }).then((p) => {
        if (active) setProfile(p);
      });
      return () => { active = false; };
    }, [])
  );

  const mushrooms = mushroomData as MushroomEntry[];

  const sortedFinds = useMemo(
    () => [...finds].sort((a, b) => new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime()),
    [finds]
  );

  const getEntry = useCallback((id: string) => {
    return mushrooms.find((m) => m.id === id);
  }, [mushrooms]);

  // Category progress
  const categories = useMemo(() => {
    const typeGroups: Record<string, { total: number; found: number }> = {};
    for (const m of mushrooms) {
      if (!typeGroups[m.broadType]) typeGroups[m.broadType] = { total: 0, found: 0 };
      typeGroups[m.broadType].total++;
      if (finds.some((f) => f.mushroomEntryId === m.id)) {
        typeGroups[m.broadType].found++;
      }
    }
    return Object.entries(typeGroups)
      .filter(([, g]) => g.total > 0)
      .sort((a, b) => b[1].found - a[1].found) as [BroadType, { total: number; found: number }][];
  }, [mushrooms, finds]);

  // Notes timeline — finds with notes, newest first
  const findsWithNotes = useMemo(() => sortedFinds.filter((f) => f.userNotes?.trim()), [sortedFinds]);

  const ListHeader = (
    <View>
      {/* Stats */}
      {profile && (
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{finds.length}</Text>
            <Text style={styles.statLabel}>Found</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{profile.totalPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.stageEmoji}>{STAGE_EMOJI[profile.level]}</Text>
            <Text style={styles.statLabel}>{profile.level}</Text>
          </View>
        </View>
      )}

      {/* Category progress */}
      {categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Category</Text>
          {categories.map(([type, g]) => (
            <CategoryProgress key={type} type={type} found={g.found} total={g.total} />
          ))}
        </View>
      )}

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'finds' && styles.tabBtnActive]}
          onPress={() => setTab('finds')}
        >
          <Text style={[styles.tabBtnText, tab === 'finds' && styles.tabBtnTextActive]}>
            All Finds
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'notes' && styles.tabBtnActive]}
          onPress={() => setTab('notes')}
        >
          <Text style={[styles.tabBtnText, tab === 'notes' && styles.tabBtnTextActive]}>
            Notes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'map' && styles.tabBtnActive]}
          onPress={() => setTab('map')}
        >
          <Text style={[styles.tabBtnText, tab === 'map' && styles.tabBtnTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Notes timeline view
  if (tab === 'notes') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>🗂️ My Collection</Text>
          <Text style={styles.subtitle}>{finds.length} of {mushrooms.length} found</Text>
        </View>
        <ScrollView contentContainerStyle={styles.notesList}>
          {ListHeader}
          {findsWithNotes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📓</Text>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptyText}>
                Add field notes when you log a find to see them here.
              </Text>
            </View>
          ) : (
            findsWithNotes.map((find) => {
              const entry = getEntry(find.mushroomEntryId);
              if (!entry) return null;
              return (
                <TouchableOpacity
                  key={find.id}
                  style={styles.noteCard}
                  onPress={() => router.push(`/dex/${entry.id}`)}
                >
                  <View style={styles.noteHeaderRow}>
                    <Text style={styles.noteMushroom}>{entry.commonName}</Text>
                    <Text style={styles.noteDate}>
                      {new Date(find.dateFound).toLocaleDateString('en-CA', {
                        month: 'short', day: 'numeric',
                      })}
                    </Text>
                  </View>
                  {find.locationNote ? (
                    <Text style={styles.noteLocation}>{'📍 ' + find.locationNote}</Text>
                  ) : null}
                  <Text style={styles.noteBody}>{find.userNotes}</Text>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Map view
  if (tab === 'map') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>🗺️ Find Map</Text>
          <Text style={styles.subtitle}>{finds.filter(f => f.lat != null && f.lng != null).length} pinned locations</Text>
        </View>
        <FindsMap finds={finds} entries={mushrooms} />
      </SafeAreaView>
    );
  }

  // Finds list
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🗂️ My Collection</Text>
        <Text style={styles.subtitle}>{finds.length} of {mushrooms.length} found</Text>
      </View>

      {sortedFinds.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          {ListHeader}
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>Nothing found yet!</Text>
            <Text style={styles.emptyText}>
              Head to the Dex and mark mushrooms as you find them.
            </Text>
            <TouchableOpacity
              style={styles.dexButton}
              onPress={() => router.push('/(tabs)/dex')}
            >
              <Text style={styles.dexButtonText}>Browse the Dex</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedFinds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => {
            const entry = getEntry(item.mushroomEntryId);
            if (!entry) return null;
            return (
              <FindCard
                find={item}
                entry={entry}
                onPress={() => router.push(`/dex/${entry.id}`)}
              />
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

  // Stats card
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 26, fontWeight: '800', color: '#2d4a1a' },
  stageEmoji: { fontSize: 26 },
  statLabel: { fontSize: 11, color: '#8a8a7a', marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: '#e8f5d8' },

  // Category progress
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  catEmoji: { fontSize: 22, marginRight: 10, width: 28 },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: 13, fontWeight: '600', color: '#2d4a1a' },
  catCount: { fontSize: 12, color: '#8a8a7a' },
  catBar: { height: 6, backgroundColor: '#e8f5d8', borderRadius: 3, overflow: 'hidden' },
  catFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 3 },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#e8f5d8',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#fff' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#8a8a7a' },
  tabBtnTextActive: { color: '#2d4a1a' },

  // Find cards
  list: { paddingBottom: 32 },
  findCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginHorizontal: 16,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  findImageBox: { width: 90, height: 90, backgroundColor: '#e8f5d8', position: 'relative' },
  findImage: { width: '100%', height: '100%' },
  findImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  myPhotoFlag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 2,
  },
  myPhotoFlagText: { fontSize: 12 },
  findInfo: { flex: 1, padding: 10 },
  findName: { fontSize: 14, fontWeight: '700', color: '#2d4a1a' },
  findScientific: { fontSize: 11, fontStyle: 'italic', color: '#8a8a7a', marginTop: 1 },
  findDate: { fontSize: 12, color: '#5a7a3a', marginTop: 3 },
  findBiome: {
    fontSize: 11,
    color: '#2d4a1a',
    fontWeight: '600',
    backgroundColor: '#e8f5d8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
    overflow: 'hidden',
  },
  findLocation: { fontSize: 11, color: '#8a8a7a', marginTop: 3 },
  findNotes: { fontSize: 12, color: '#8a8a7a', marginTop: 4, fontStyle: 'italic' },
  findPoints: { fontSize: 13, fontWeight: '700', color: '#8b6914', padding: 10 },

  // Notes tab
  notesList: { paddingBottom: 32 },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  noteHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  noteMushroom: { fontSize: 14, fontWeight: '700', color: '#2d4a1a', flex: 1 },
  noteDate: { fontSize: 12, color: '#8a8a7a' },
  noteLocation: { fontSize: 12, color: '#8a8a7a', marginBottom: 6 },
  noteBody: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },

  // Empty states
  emptyContainer: { flexGrow: 1 },
  emptyBox: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#2d4a1a', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  dexButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  dexButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
