import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserFinds, getCachedFinds } from '../../src/storage/userFinds';
import { MushroomEntry, UserFind, BroadType } from '../../src/types';
import mushroomData from '../../data/mushrooms.json';
import {
  getAllFriendsFindsIndex,
  getCachedFriendsFindsIndex,
  FriendsFindsIndex,
} from '../../src/storage/friendData';
import { FriendSummary } from '../../src/storage/friends';

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

const RARITY_ORDER: Record<string, number> = {
  'Lucky Find': 0,
  'Rare Find': 1,
  'Special Find': 2,
  'Uncommon': 3,
  'Common': 4,
};

const RARITY_COLOUR: Record<string, string> = {
  'Common': '#8a8a7a',
  'Uncommon': '#5a7a3a',
  'Special Find': '#8b6914',
  'Rare Find': '#8b3a14',
  'Lucky Find': '#6a1a8b',
};

type FoundFilter = 'all' | 'found' | 'not-found';
type SortOrder = 'default' | 'alpha' | 'rarity' | 'found-first';

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label + ' '}
      </Text>
    </TouchableOpacity>
  );
}

function MushroomCard({
  entry,
  found,
  onPress,
  friendFoundBy,
}: {
  entry: MushroomEntry;
  found: boolean;
  onPress: () => void;
  friendFoundBy?: FriendSummary[];
}) {
  const heroImage = entry.images.find((img) => img.isHero);
  const [imgError, setImgError] = React.useState(false);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const fallbackEmoji = BROAD_TYPE_EMOJI[entry.broadType] ?? '🍄';

  return (
    <TouchableOpacity style={[styles.card, found && styles.cardFound]} onPress={onPress}>
      <View style={styles.cardImageContainer}>
        {heroImage && !imgError ? (
          <>
            {!imgLoaded && (
              <View style={styles.cardImagePlaceholder}>
                <Text style={styles.cardImageEmoji}>{fallbackEmoji}</Text>
              </View>
            )}
            <Image
              source={{ uri: heroImage.urlOrLocalPath }}
              style={[styles.cardImage, !imgLoaded && { position: 'absolute', opacity: 0 }]}
              contentFit="cover"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImageEmoji}>{fallbackEmoji}</Text>
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
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText} numberOfLines={1}>
              {BROAD_TYPE_EMOJI[entry.broadType]} {entry.broadType + ' '}
            </Text>
          </View>
          <Text
            style={[styles.rarityDot, { color: RARITY_COLOUR[entry.rarityTier] ?? '#8a8a7a' }]}
            numberOfLines={1}
          >
            {'● ' + entry.rarityTier + ' '}
          </Text>
        </View>
        {friendFoundBy && friendFoundBy.length > 0 && (
          <Text style={styles.friendTag} numberOfLines={1}>
            {friendFoundBy.length === 1
              ? `Found by ${friendFoundBy[0].displayName}`
              : `Found by ${friendFoundBy[0].displayName} +${friendFoundBy.length - 1}`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function DexScreen() {
  const router = useRouter();
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<BroadType | null>(null);
  const [foundFilter, setFoundFilter] = useState<FoundFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [friendsIndex, setFriendsIndex] = useState<FriendsFindsIndex | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const cf = getCachedFinds();
      if (cf) setFinds(cf);
      getUserFinds({ force: true }).then((f) => {
        if (active) setFinds(f);
      });
      // Load friends finds index for "found by friends" tags
      const cachedIdx = getCachedFriendsFindsIndex();
      if (cachedIdx) setFriendsIndex(cachedIdx);
      getAllFriendsFindsIndex().then((idx) => {
        if (active) setFriendsIndex(idx);
      });
      return () => { active = false; };
    }, [])
  );

  const allMushrooms = mushroomData as MushroomEntry[];
  const foundIds = useMemo(() => new Set(finds.map((f) => f.mushroomEntryId)), [finds]);

  // Types that actually exist in the dex
  const presentTypes = useMemo(
    () => [...new Set(allMushrooms.map((m) => m.broadType))] as BroadType[],
    [allMushrooms]
  );

  const filtered = useMemo(() => {
    let list = [...allMushrooms];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.commonName.toLowerCase().includes(q) ||
          m.scientificName.toLowerCase().includes(q) ||
          m.alternateNames.some((n) => n.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (activeType) {
      list = list.filter((m) => m.broadType === activeType);
    }

    // Found filter
    if (foundFilter === 'found') {
      list = list.filter((m) => foundIds.has(m.id));
    } else if (foundFilter === 'not-found') {
      list = list.filter((m) => !foundIds.has(m.id));
    }

    // Sort
    if (sortOrder === 'alpha') {
      list.sort((a, b) => a.commonName.localeCompare(b.commonName));
    } else if (sortOrder === 'rarity') {
      list.sort(
        (a, b) => (RARITY_ORDER[a.rarityTier] ?? 99) - (RARITY_ORDER[b.rarityTier] ?? 99)
      );
    } else if (sortOrder === 'found-first') {
      list.sort((a, b) => {
        const af = foundIds.has(a.id) ? 0 : 1;
        const bf = foundIds.has(b.id) ? 0 : 1;
        return af - bf;
      });
    }

    return list;
  }, [allMushrooms, searchQuery, activeType, foundFilter, sortOrder, foundIds]);

  const activeFilterCount =
    (activeType ? 1 : 0) + (foundFilter !== 'all' ? 1 : 0) + (sortOrder !== 'default' ? 1 : 0);

  function clearAll() {
    setSearchQuery('');
    setActiveType(null);
    setFoundFilter('all');
    setSortOrder('default');
  }

  const ListHeader = (
    <View>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search mushrooms…"
            placeholderTextColor="#b0b0a0"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Type filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        <FilterChip
          label="All types"
          active={activeType === null}
          onPress={() => setActiveType(null)}
        />
        {presentTypes.map((type) => (
          <FilterChip
            key={type}
            label={`${BROAD_TYPE_EMOJI[type]} ${type}`}
            active={activeType === type}
            onPress={() => setActiveType(activeType === type ? null : type)}
          />
        ))}
      </ScrollView>

      {/* Found + Sort filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        <FilterChip
          label="All"
          active={foundFilter === 'all'}
          onPress={() => setFoundFilter('all')}
        />
        <FilterChip
          label="✓ Found"
          active={foundFilter === 'found'}
          onPress={() => setFoundFilter(foundFilter === 'found' ? 'all' : 'found')}
        />
        <FilterChip
          label="Not found"
          active={foundFilter === 'not-found'}
          onPress={() => setFoundFilter(foundFilter === 'not-found' ? 'all' : 'not-found')}
        />
        <View style={styles.chipDivider} />
        <FilterChip
          label="A–Z"
          active={sortOrder === 'alpha'}
          onPress={() => setSortOrder(sortOrder === 'alpha' ? 'default' : 'alpha')}
        />
        <FilterChip
          label="Rarest first"
          active={sortOrder === 'rarity'}
          onPress={() => setSortOrder(sortOrder === 'rarity' ? 'default' : 'rarity')}
        />
        <FilterChip
          label="Found first"
          active={sortOrder === 'found-first'}
          onPress={() => setSortOrder(sortOrder === 'found-first' ? 'default' : 'found-first')}
        />
      </ScrollView>

      {/* Results count + clear */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          {filtered.length} of {allMushrooms.length} shown
        </Text>
        {activeFilterCount > 0 || searchQuery.length > 0 ? (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearAll}>Clear all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 FungiDex</Text>
        <Text style={styles.subtitle}>{finds.length}/{allMushrooms.length} found</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>Try a different search or clear the filters.</Text>
            <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <MushroomCard
            entry={item}
            found={foundIds.has(item.id)}
            onPress={() => router.push(`/dex/${item.id}`)}
            friendFoundBy={friendsIndex?.bySpecies.get(item.id)}
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

  // Search
  searchRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: '#2d4a1a' },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 14, color: '#8a8a7a' },

  // Filter chips
  chipScroll: { flexGrow: 0 },
  chipScrollContent: { paddingHorizontal: 12, paddingVertical: 6 },
  filterChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#5a7a3a',
    borderColor: '#5a7a3a',
  },
  filterChipText: { fontSize: 13, color: '#5a7a3a', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  chipDivider: { width: 1, backgroundColor: '#d4e8b8', marginRight: 8, marginVertical: 4 },

  // Results bar
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  resultsText: { fontSize: 12, color: '#8a8a7a' },
  clearAll: { fontSize: 12, color: '#5a7a3a', fontWeight: '700' },

  // Grid
  list: { paddingHorizontal: 10, paddingBottom: 24 },
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
  cardFound: { borderColor: '#5a7a3a', borderWidth: 2 },
  cardImageContainer: { height: 110, backgroundColor: '#e8f5d8', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  cardScientific: { fontSize: 11, color: '#8a8a7a', fontStyle: 'italic', marginTop: 2 },
  cardMeta: { marginTop: 6 },
  typeChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  typeChipText: { fontSize: 11, color: '#2d4a1a', fontWeight: '600' },
  rarityDot: { fontSize: 11, fontWeight: '600' },
  friendTag: {
    fontSize: 11,
    color: '#5a7a3a',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Empty state
  emptyBox: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2d4a1a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', marginBottom: 20 },
  clearButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  clearButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
