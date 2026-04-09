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
import { MushroomEntry, UserFind } from '../../src/types';
import mushroomData from '../../data/mushrooms.json';

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

const RARITY_COLOUR: Record<string, string> = {
  'Common': '#8a8a7a',
  'Uncommon': '#5a7a3a',
  'Special Find': '#8b6914',
  'Rare Find': '#8b3a14',
  'Lucky Find': '#6a1a8b',
};

function MushroomCard({
  entry,
  found,
  onPress,
}: {
  entry: MushroomEntry;
  found: boolean;
  onPress: () => void;
}) {
  const heroImage = entry.images.find((img) => img.isHero);

  return (
    <TouchableOpacity style={[styles.card, found && styles.cardFound]} onPress={onPress}>
      <View style={styles.cardImageContainer}>
        {heroImage ? (
          <Image
            source={{ uri: heroImage.urlOrLocalPath }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImageEmoji}>
              {BROAD_TYPE_EMOJI[entry.broadType] ?? '🍄'}
            </Text>
          </View>
        )}
        {found && (
          <View style={styles.foundBadge}>
            <Text style={styles.foundBadgeText}>✓</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{entry.commonName}</Text>
        <Text style={styles.cardScientific} numberOfLines={1}>{entry.scientificName}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.typeChip]}>
            <Text style={styles.typeChipText}>
              {BROAD_TYPE_EMOJI[entry.broadType]} {entry.broadType}
            </Text>
          </View>
          <Text style={[styles.rarityDot, { color: RARITY_COLOUR[entry.rarityTier] ?? '#8a8a7a' }]}>
            ● {entry.rarityTier}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DexScreen() {
  const router = useRouter();
  const [finds, setFinds] = useState<UserFind[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserFinds().then((f) => { if (active) setFinds(f); });
      return () => { active = false; };
    }, [])
  );

  const foundIds = new Set(finds.map((f) => f.mushroomEntryId));
  const mushrooms = mushroomData as MushroomEntry[];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 Mushroom Dex</Text>
        <Text style={styles.subtitle}>
          {finds.length}/{mushrooms.length} found
        </Text>
      </View>
      <FlatList
        data={mushrooms}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MushroomCard
            entry={item}
            found={foundIds.has(item.id)}
            onPress={() => router.push(`/dex/${item.id}`)}
          />
        )}
      />
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
  list: { padding: 10, paddingBottom: 24 },
  row: { gap: 10 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8d8',
  },
  cardFound: {
    borderColor: '#5a7a3a',
    borderWidth: 2,
  },
  cardImageContainer: {
    height: 110,
    backgroundColor: '#e8f5d8',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageEmoji: { fontSize: 48 },
  foundBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardBody: { padding: 10 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#2d4a1a', lineHeight: 18 },
  cardScientific: {
    fontSize: 11,
    color: '#8a8a7a',
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardMeta: { marginTop: 6, gap: 4 },
  typeChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  typeChipText: { fontSize: 11, color: '#2d4a1a', fontWeight: '600' },
  rarityDot: { fontSize: 11, fontWeight: '600' },
});
