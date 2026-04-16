import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { UserFind, MushroomEntry } from '../types';

/**
 * Helper — marker color by rarity tier
 */
function markerColor(rarity: string): string {
  if (rarity === 'Uncommon') return '#3a6aba';
  if (rarity === 'Special Find') return '#9a6a1a';
  if (rarity === 'Rare Find' || rarity === 'Lucky Find') return '#aa2a2a';
  return '#4a9a4a'; // Common
}

const RARITY_FILTERS = ['All', 'Common', 'Uncommon', 'Special Find', 'Rare Find', 'Lucky Find'];

interface FindsMapProps {
  finds: UserFind[];
  entries: MushroomEntry[];
}

const FindsMap: React.FC<FindsMapProps> = ({ finds, entries }) => {
  // Hooks must come first — before any conditional returns.
  const [selectedFind, setSelectedFind] = useState<UserFind | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // react-native-maps requires a native build — not available in Expo Go.
  if (Constants.appOwnership === 'expo') {
    return (
      <View style={styles.expoGoPlaceholder}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺️</Text>
        <Text style={styles.emptyTitle}>Map requires a dev build</Text>
        <Text style={styles.emptySubtitle}>
          Install the FungiDex dev build to use the find map. Your pinned locations are being saved and will appear here.
        </Text>
      </View>
    );
  }

  // Safe to require react-native-maps — only reached in native builds.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: MapView, Marker } = require('react-native-maps') as {
    default: typeof import('react-native-maps').default;
    Marker: typeof import('react-native-maps').Marker;
  };

  // Derived data
  const mappableFinds = finds.filter(
    (f) => typeof f.lat === 'number' && typeof f.lng === 'number'
  );

  const filteredFinds = mappableFinds.filter((find) => {
    if (activeFilter === 'All') return true;
    const entry = entries.find((e) => e.id === find.mushroomEntryId);
    return entry?.rarityTier === activeFilter;
  });

  // Compute initial region
  const getInitialRegion = (): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } => {
    if (filteredFinds.length > 0) {
      const first = filteredFinds[0];
      return {
        latitude: first.lat!,
        longitude: first.lng!,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    return {
      latitude: 43.7,
      longitude: -79.4,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  };

  const selectedEntry = selectedFind
    ? entries.find((e) => e.id === selectedFind.mushroomEntryId)
    : null;

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (mappableFinds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺️</Text>
        <Text style={styles.emptyTitle}>No mapped finds yet</Text>
        <Text style={styles.emptySubtitle}>
          Log a find and tap 'Use My Location' to pin it here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filter chips — horizontal ScrollView above map */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {RARITY_FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                  {filter === 'All' ? `${filter} (${mappableFinds.length})` : filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Map */}
      <MapView
        style={{ flex: 1 }}
        initialRegion={getInitialRegion()}
        showsUserLocation={true}
      >
        {filteredFinds.map((find) => {
          const entry = entries.find((e) => e.id === find.mushroomEntryId);
          if (!entry || find.lat == null || find.lng == null) return null;
          return (
            <Marker
              key={find.id}
              coordinate={{ latitude: find.lat, longitude: find.lng }}
              onPress={() => setSelectedFind(find)}
            >
              <View style={[styles.markerDot, { backgroundColor: markerColor(entry.rarityTier) }]} />
            </Marker>
          );
        })}
      </MapView>

      {/* Bottom sheet */}
      {selectedFind && selectedEntry && (
        <View style={styles.bottomSheet}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedFind(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.sheetHeader}>
            <View style={styles.imageContainer}>
              {selectedEntry.images?.find((img) => img.isHero) ? (
                <Image
                  source={{ uri: selectedEntry.images.find((img) => img.isHero)?.urlOrLocalPath }}
                  style={styles.heroImage}
                />
              ) : (
                <View style={[styles.heroImage, styles.emojiFallback]}>
                  <Text style={{ fontSize: 40 }}>🍄</Text>
                </View>
              )}
            </View>

            <View style={styles.headerText}>
              <Text style={styles.commonName}>{selectedEntry.commonName}</Text>
              <Text style={styles.scientificName}>{selectedEntry.scientificName}</Text>
              
              <View
                style={[
                  styles.rarityBadge,
                  { backgroundColor: markerColor(selectedEntry.rarityTier) + '26' }, // 15% opacity is #26 in hex
                ]}
              >
                <Text style={[styles.rarityText, { color: markerColor(selectedEntry.rarityTier) }]}>
                  {selectedEntry.rarityTier}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sheetBody}>
            <Text style={styles.dateLabel}>{formatDate(selectedFind.dateFound)}</Text>
            
            {selectedFind.locationNote ? (
              <Text style={styles.locationNote}>📍 {selectedFind.locationNote}</Text>
            ) : null}
            
            {selectedFind.biomeTag ? (
              <Text style={styles.biomeTag}>{selectedFind.biomeTag}</Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  filterContainer: {
    padding: 12,
    backgroundColor: '#f9f6f0',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#5a7a3a',
  },
  chipInactive: {
    backgroundColor: 'white',
    borderColor: '#d4e8b8',
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  chipTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  chipTextInactive: {
    color: '#5a7a3a',
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#d4e8b8',
    // Depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#8a8a7a',
  },
  sheetHeader: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f9f6f0',
  },
  heroImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  emojiFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  commonName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 2,
  },
  scientificName: {
    fontSize: 13,
    color: '#8a8a7a',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  rarityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sheetBody: {
    marginTop: 5,
  },
  dateLabel: {
    fontSize: 13,
    color: '#2d4a1a',
    fontWeight: '600',
    marginBottom: 6,
  },
  locationNote: {
    fontSize: 13,
    color: '#5a7a3a',
    marginBottom: 4,
  },
  biomeTag: {
    fontSize: 12,
    color: '#8a8a7a',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f6f0',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8a8a7a',
    textAlign: 'center',
  },
  expoGoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f6f0',
    padding: 40,
  },
});

export default FindsMap;
