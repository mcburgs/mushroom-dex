import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { InatObservation } from '../utils/inatApi';

function formatObservedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently spotted';
  return `Spotted ${date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
}

export default function RecentSightings({
  observations,
  loading,
  onRetry,
  showError,
}: {
  observations: InatObservation[];
  loading: boolean;
  onRetry: () => void;
  showError: boolean;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>Recently Spotted Nearby</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.skeletonCard} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (showError) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>Recently Spotted Nearby</Text>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Couldn't load recent sightings</Text>
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!observations.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Recently Spotted Nearby</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {observations.map((observation) => (
          <View key={observation.id} style={styles.card}>
            <View style={styles.imageWrap}>
              {observation.imageUrl ? (
                <Image source={{ uri: observation.imageUrl }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={styles.imageFallback}>
                  <Text style={styles.imageFallbackText}>🍄</Text>
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {observation.dexMatch?.commonName ?? observation.taxonName}
            </Text>
            <Text style={styles.meta}>{formatObservedDate(observation.observedOn)}</Text>
            {typeof observation.distanceKm === 'number' ? (
              <Text style={styles.meta}>~{Math.round(observation.distanceKm)}km away</Text>
            ) : null}
            {observation.dexMatch ? (
              <TouchableOpacity
                style={styles.dexBadge}
                onPress={() => router.push(`/dex/${observation.dexMatch!.id}`)}
              >
                <Text style={styles.dexBadgeText}>
                  {observation.genusMatch ? 'Genus in Dex →' : 'In Dex →'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <Text style={styles.footer}>Sightings via iNaturalist · public research-grade observations.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  heading: { fontSize: 18, fontWeight: '700', color: '#2d4a1a', marginBottom: 12 },
  card: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 10,
    marginRight: 10,
  },
  imageWrap: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e8f5d8',
    marginBottom: 10,
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: { fontSize: 30 },
  name: { fontSize: 14, fontWeight: '700', color: '#2d4a1a', minHeight: 36 },
  meta: { fontSize: 12, color: '#8a8a7a', marginTop: 4 },
  dexBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dexBadgeText: { fontSize: 12, color: '#2d4a1a', fontWeight: '700' },
  footer: { fontSize: 11, color: '#8a8a7a', marginTop: 10 },
  skeletonCard: {
    width: 160,
    height: 210,
    borderRadius: 16,
    backgroundColor: '#ece8df',
    marginRight: 10,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
  },
  errorText: { fontSize: 14, color: '#8a8a7a', marginBottom: 10 },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#5a7a3a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
