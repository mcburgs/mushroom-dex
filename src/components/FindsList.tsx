import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserFind, MushroomEntry } from '../types';
import mushroomData from '../../data/mushrooms.json';

const MUSHROOMS = mushroomData as MushroomEntry[];
const MUSHROOM_BY_ID = new Map(MUSHROOMS.map((m) => [m.id, m]));

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

function FindCard({
  find,
  entry,
  onPress,
  showPhoto,
}: {
  find: UserFind;
  entry: MushroomEntry;
  onPress: () => void;
  showPhoto?: boolean;
}) {
  const heroImage = entry.images.find((img) => img.isHero);
  // Only show user photos that are remote URLs (not local file paths)
  const remotePhotos = (find.userPhotoPaths ?? []).filter(
    (p) => p.startsWith('http://') || p.startsWith('https://'),
  );
  const displayPhoto =
    showPhoto && remotePhotos.length > 0
      ? remotePhotos[0]
      : heroImage?.urlOrLocalPath ?? null;

  return (
    <TouchableOpacity style={styles.findCard} onPress={onPress}>
      <View style={styles.findImageBox}>
        {displayPhoto ? (
          <Image source={{ uri: displayPhoto }} style={styles.findImage} resizeMode="cover" />
        ) : (
          <View style={styles.findImagePlaceholder}>
            <Text style={{ fontSize: 28 }}>
              {BROAD_TYPE_EMOJI[entry.broadType] ?? '🍄'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.findInfo}>
        <Text style={styles.findName}>{entry.commonName}</Text>
        <Text style={styles.findScientific} numberOfLines={1}>
          {entry.scientificName}
        </Text>
        <Text style={styles.findDate}>
          {new Date(find.dateFound).toLocaleDateString('en-CA', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        {find.biomeTag ? <Text style={styles.findBiome}>{find.biomeTag}</Text> : null}
        {find.locationNote ? (
          <Text style={styles.findLocation} numberOfLines={1}>
            {'📍 ' + find.locationNote}
          </Text>
        ) : null}
        {find.userNotes ? (
          <Text style={styles.findNotes} numberOfLines={2}>
            {find.userNotes}
          </Text>
        ) : null}
      </View>
      <Text style={styles.findPoints}>{'+' + entry.pointsValue}</Text>
    </TouchableOpacity>
  );
}

interface Props {
  finds: UserFind[];
  header?: React.ReactElement;
  emptyText?: string;
  showUserPhotos?: boolean;
}

export default function FindsList({ finds, header, emptyText, showUserPhotos = true }: Props) {
  const router = useRouter();

  const sorted = React.useMemo(
    () =>
      [...finds].sort(
        (a, b) => new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime(),
      ),
    [finds],
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id || item.mushroomEntryId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>{emptyText ?? 'No finds yet'}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const entry = MUSHROOM_BY_ID.get(item.mushroomEntryId);
        if (!entry) return null;
        return (
          <FindCard
            find={item}
            entry={entry}
            showPhoto={showUserPhotos}
            onPress={() => router.push(`/dex/${entry.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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
  findImageBox: {
    width: 90,
    height: 90,
    backgroundColor: '#e8f5d8',
    position: 'relative',
  },
  findImage: { width: '100%', height: '100%' },
  findImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findInfo: { flex: 1, padding: 10 },
  findName: { fontSize: 14, fontWeight: '700', color: '#2d4a1a' },
  findScientific: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#8a8a7a',
    marginTop: 1,
  },
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
  emptyBox: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 10,
  },
});
