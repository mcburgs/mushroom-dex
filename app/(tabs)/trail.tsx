import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import ForecastCard from '../../src/components/ForecastCard';
import RecentSightings from '../../src/components/RecentSightings';
import { HABITAT_OPTIONS, WeatherSnapshot, buildForecast, getEcologicalSeason } from '../../src/utils/forecastEngine';
import { buildNeutralWeatherSnapshot, fetchWeatherSnapshot } from '../../src/utils/weatherApi';
import { fetchRecentSightings, InatObservation } from '../../src/utils/inatApi';
import { getMysteryLogs, getCachedMysteryLogs } from '../../src/storage/mysteryLogs';
import { auth, db } from '../../src/firebase';
import { addPoints, getUserProfile, getCachedProfile } from '../../src/storage/userProfile';
import { UserProfile, TrailInsightsResult, getStageForPoints } from '../../src/types';
import { generateTrailInsights } from '../../src/utils/geminiClient';

const HABITAT_KEY = (uid: string) => `trail:lastHabitat:${uid}`;
const FORECAST_POINTS_KEY = (uid: string) => `trail:lastForecastPointsDate:${uid}`;
const AI_INSIGHTS_CACHE_VERSION = 'v4';
const AI_INSIGHTS_KEY = (uid: string, habitatId: string, weatherScore: number, locSlug: string) => {
  const date = new Date().toISOString().slice(0, 10);
  return `trail:aiInsights:${AI_INSIGHTS_CACHE_VERSION}:${uid}:${habitatId}:${weatherScore}:${locSlug}:${date}`;
};

function getFieldTip(season: string, conditionLabel: string) {
  if (conditionLabel.includes('Excellent') && season === 'fall') {
    return 'Check under deciduous trees after rain. Fresh flushes often appear within 48 hours.';
  }
  if (conditionLabel.includes('Excellent') && season === 'spring') {
    return 'Move slowly around damp woods and trail edges where early-season species push through leaf litter.';
  }
  if (conditionLabel.includes('Poor')) {
    return 'Focus on shaded, moisture-holding pockets and old wood instead of wide open ground.';
  }
  return 'Scan substrate first: wood, roots, and damp ground usually narrow your best options quickly.';
}

function dateLabel(date = new Date()) {
  return date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
}

function rarityBadgeColor(rarity: string) {
  if (rarity === 'Uncommon') return '#5a7a3a';
  if (rarity === 'Special Find') return '#8b6914';
  if (rarity === 'Rare Find' || rarity === 'Lucky Find') return '#8b1a1a';
  return '#8a8a7a';
}

function ForecastSpeciesRow({
  title,
  scientificName,
  rarity,
  note,
  imageUrl,
  onPress,
}: {
  title: string;
  scientificName: string;
  rarity: string;
  note: string;
  imageUrl?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.speciesRow} onPress={onPress}>
      <View style={styles.speciesThumbWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.speciesThumb} contentFit="cover" />
        ) : (
          <Text style={styles.speciesFallback}>M</Text>
        )}
      </View>
      <View style={styles.speciesBody}>
        <View style={styles.speciesTitleRow}>
          <Text style={styles.speciesTitle}>{title}</Text>
          <Text style={[styles.rarityChip, { color: rarityBadgeColor(rarity) }]}>{rarity}</Text>
        </View>
        <Text style={styles.speciesScientific}>{scientificName}</Text>
        <Text style={styles.speciesNote} numberOfLines={1}>
          {note}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TrailScreen() {
  const router = useRouter();
  const [selectedHabitat, setSelectedHabitat] = useState(HABITAT_OPTIONS[0]);
  const [weather, setWeather] = useState<WeatherSnapshot>(() => buildNeutralWeatherSnapshot(getEcologicalSeason()));
  const [profile, setProfile] = useState<UserProfile | undefined>();
  const [showRare, setShowRare] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [sightingsLoading, setSightingsLoading] = useState(false);
  const [sightingsError, setSightingsError] = useState(false);
  const [sightings, setSightings] = useState<InatObservation[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [locationName, setLocationName] = useState<string | undefined>();
  const [mysteryLogs, setMysteryLogs] = useState<Array<{ id: string; date: string; locationNote: string; overallForm: string; colorPrimary: string; suggestedMushroomIds: string[] }>>([]);
  const [aiInsights, setAiInsights] = useState<TrailInsightsResult | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [spotlightExpanded, setSpotlightExpanded] = useState(false);
  const [spotlightCanExpand, setSpotlightCanExpand] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    AsyncStorage.getItem(HABITAT_KEY(uid)).then((value) => {
      const found = HABITAT_OPTIONS.find((option) => option.id === value);
      if (found) setSelectedHabitat(found);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const cp = getCachedProfile(); const cm = getCachedMysteryLogs();
      if (cp) setProfile(cp);
      if (cm) setMysteryLogs(cm.slice(0, 3).map((log) => ({
        id: log.id, date: log.date, locationNote: log.locationNote,
        overallForm: log.overallForm, colorPrimary: log.colorPrimary,
        suggestedMushroomIds: log.suggestedMushroomIds,
      })));
      getUserProfile({ force: true }).then((nextProfile) => {
        if (active) setProfile(nextProfile);
      });
      getMysteryLogs({ force: true }).then((logs) => {
        if (active) {
          setMysteryLogs(
            logs.slice(0, 3).map((log) => ({
              id: log.id,
              date: log.date,
              locationNote: log.locationNote,
              overallForm: log.overallForm,
              colorPrimary: log.colorPrimary,
              suggestedMushroomIds: log.suggestedMushroomIds,
            }))
          );
        }
      });
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    let active = true;

    async function initTrail() {
      setLoadingWeather(true);
      const season = getEcologicalSeason();

      let coords: { lat: number; lng: number } | undefined;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted' && active) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (active) {
            coords = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserLocation(coords);

            try {
              const geoResults = await Location.reverseGeocodeAsync({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              if (geoResults.length > 0 && active) {
                const geo = geoResults[0];
                const parts: string[] = [];
                if (geo.name && geo.name !== geo.city && geo.name !== geo.street) {
                  parts.push(geo.name);
                }
                if (geo.city) parts.push(geo.city);
                if (geo.region) parts.push(geo.region);
                if (geo.isoCountryCode) parts.push(geo.isoCountryCode);
                const name = parts.filter(Boolean).join(', ');
                if (name) setLocationName(name);
              }
            } catch {
              // Reverse geocode failed — AI will proceed without location context
            }
          }
        }
      } catch {
        // Location unavailable — weather will fall back to default region
      }

      if (!active) return;
      const snapshot = await fetchWeatherSnapshot(season, coords?.lat, coords?.lng);
      if (!active) return;
      setWeather(snapshot);
      setLoadingWeather(false);
    }

    void initTrail();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    AsyncStorage.setItem(HABITAT_KEY(uid), selectedHabitat.id).catch(() => {});
  }, [selectedHabitat]);

  useEffect(() => {
    let active = true;

    async function awardDailyPoints() {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const today = new Date().toISOString().slice(0, 10);
      const lastAward = await AsyncStorage.getItem(FORECAST_POINTS_KEY(uid));
      if (lastAward === today) return;
      await addPoints(5);
      await AsyncStorage.setItem(FORECAST_POINTS_KEY(uid), today);
      if (!active) return;
      setProfile((current) => (current ? { ...current, totalPoints: current.totalPoints + 5 } : current));
    }

    void awardDailyPoints();

    return () => {
      active = false;
    };
  }, []);

  const forecast = useMemo(
    () =>
      buildForecast({
        habitat: selectedHabitat,
        weather,
        profile,
      }),
    [profile, selectedHabitat, weather]
  );

  useEffect(() => {
    let active = true;

    async function loadAiInsights() {
      // Don't attempt if weather hasn't loaded, no best bets, or no user
      const uid = auth.currentUser?.uid;
      if (loadingWeather || forecast.bestBets.length === 0 || !uid) return;

      const locSlug = locationName ? locationName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) : 'unknown';
      const cacheKey = AI_INSIGHTS_KEY(uid, selectedHabitat.id, weather.weatherScore, locSlug);

      // Check cache first
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as TrailInsightsResult;
          if (active) setAiInsights(parsed);
          return;
        }
      } catch {
        // Cache miss or parse error — proceed to fetch
      }

      if (!active) return;
      setAiInsightsLoading(true);

      const topEntry = forecast.bestBets[0];
      const userLevel = profile ? getStageForPoints(profile.totalPoints) : 'Explorer';

      const result = await generateTrailInsights({
        season: forecast.season,
        conditionLabel: weather.conditionLabel,
        habitatLabel: selectedHabitat.label,
        rainLastFiveDaysMm: weather.rainLastFiveDaysMm,
        rainLastThreeDaysMm: weather.rainLastThreeDaysMm,
        tempMinC: weather.tempMinC,
        tempMaxC: weather.tempMaxC,
        bestBetNames: forecast.bestBets.slice(0, 5).map((e) => e.commonName),
        spotlightSpecies: {
          commonName: topEntry.commonName,
          scientificName: topEntry.scientificName,
          broadType: topEntry.broadType,
          keyTraits: topEntry.keyTraits.slice(0, 5),
          habitatTags: topEntry.habitatTags.slice(0, 5),
        },
        userLevel,
        locationName,
      });

      if (!active) return;
      setAiInsightsLoading(false);

      if (result) {
        setAiInsights(result);
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // Ignore cache write failures
        }
      }
    }

    // Clear stale insights when dependencies change (before loading new ones)
    setAiInsights(null);
    setAiInsightsLoading(false);

    void loadAiInsights();

    return () => {
      active = false;
    };
  }, [forecast, selectedHabitat, weather, loadingWeather, profile, locationName]);

  useEffect(() => {
    setSpotlightExpanded(false);
    setSpotlightCanExpand((aiInsights?.speciesSpotlight?.length ?? 0) > 140);
  }, [aiInsights?.speciesSpotlight, selectedHabitat.id]);

  const loadSightings = useCallback(async () => {
    setSightingsLoading(true);
    setSightingsError(false);
    try {
      const items = await fetchRecentSightings(userLocation);
      setSightings(items);
    } catch {
      setSightings([]);
      setSightingsError(true);
    } finally {
      setSightingsLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    void loadSightings();
  }, [loadSightings]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Trail Mode</Text>
            <Text style={styles.subtitle}>Know what to expect before and during a foray.</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push({ pathname: '/trail/field-id', params: { fromTrail: '1' } })}
          >
            <Text style={styles.primaryActionText}>Field ID</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/(tabs)/mystery')}>
            <Text style={styles.secondaryActionText}>Mystery Log</Text>
          </TouchableOpacity>
        </View>

        <ForecastCard
          weather={loadingWeather ? { ...weather, conditionLabel: 'Loading conditions', weatherSummary: 'Fetching weather…' } : weather}
          seasonLabel={forecast.seasonLabel}
          dateLabel={dateLabel()}
          fieldTip={getFieldTip(forecast.season, weather.conditionLabel)}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.habitatScroll}>
          {HABITAT_OPTIONS.map((option) => {
            const active = option.id === selectedHabitat.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.habitatChip, active && styles.habitatChipActive]}
                onPress={() => setSelectedHabitat(option)}
              >
                <Text style={styles.habitatEmoji}>{option.emoji}</Text>
                <Text style={[styles.habitatLabel, active && styles.habitatLabelActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {aiInsights?.speciesSpotlight && forecast.bestBets.length > 0 ? (
          <View style={styles.spotlightCard}>
            <View style={styles.spotlightHeader}>
              <View style={styles.spotlightThumbWrap}>
                {forecast.bestBets[0].images.find((img) => img.isHero) ? (
                  <Image
                    source={{ uri: forecast.bestBets[0].images.find((img) => img.isHero)!.urlOrLocalPath }}
                    style={styles.spotlightThumb}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.speciesFallback}>M</Text>
                )}
              </View>
              <View style={styles.spotlightHeaderText}>
                <Text style={styles.spotlightName}>{forecast.bestBets[0].commonName}</Text>
                <Text style={styles.spotlightScientific}>{forecast.bestBets[0].scientificName}</Text>
              </View>
            </View>
            <Text
              style={styles.spotlightBody}
              numberOfLines={spotlightExpanded ? undefined : 3}
            >
              {aiInsights.speciesSpotlight}
            </Text>
            <View style={styles.spotlightFooter}>
              <Text style={styles.spotlightLabel}>✦ Species Spotlight</Text>
              {spotlightCanExpand ? (
                <TouchableOpacity
                  style={styles.spotlightExpandButton}
                  onPress={() => setSpotlightExpanded((current) => !current)}
                >
                  <Text style={styles.spotlightExpandText}>{spotlightExpanded ? 'See less' : 'See more'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : aiInsightsLoading ? (
          <View style={styles.spotlightCard}>
            <View style={styles.spotlightSkeleton}>
              <View style={styles.spotlightSkeletonBar} />
              <View style={[styles.spotlightSkeletonBar, { width: '75%' }]} />
              <View style={[styles.spotlightSkeletonBar, { width: '50%' }]} />
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Best Bets Today</Text>
        {forecast.bestBets.map((entry) => (
          <ForecastSpeciesRow
            key={entry.id}
            title={entry.commonName}
            scientificName={entry.scientificName}
            rarity={entry.rarityTier}
            note={entry.encounterRarity}
            imageUrl={entry.images.find((image) => image.isHero)?.urlOrLocalPath}
            onPress={() => router.push(`/dex/${entry.id}`)}
          />
        ))}

        {forecast.keepAnEyeOut.length > 0 ? (
          <View style={styles.rareWrap}>
            <TouchableOpacity style={styles.rareHeader} onPress={() => setShowRare((current) => !current)}>
              <Text style={styles.sectionTitle}>Keep an Eye Out</Text>
              <Text style={styles.expandText}>{showRare ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {showRare
              ? forecast.keepAnEyeOut.map((entry) => (
                  <ForecastSpeciesRow
                    key={`rare-${entry.id}`}
                    title={entry.commonName}
                    scientificName={entry.scientificName}
                    rarity={entry.rarityTier}
                    note={entry.encounterRarity}
                    imageUrl={entry.images.find((image) => image.isHero)?.urlOrLocalPath}
                    onPress={() => router.push(`/dex/${entry.id}`)}
                  />
                ))
              : <Text style={styles.rareHint}>Rare finds sometimes appear in these conditions.</Text>}
          </View>
        ) : null}

        <View style={styles.strategyCard}>
          <Text style={styles.sectionTitle}>Today's Foraging Strategy</Text>
          <Text style={styles.strategyText}>
            {aiInsights?.fieldBriefing ?? forecast.strategyText}
          </Text>
          {aiInsights?.fieldBriefing ? (
            <Text style={styles.aiIndicator}>✦ AI-enhanced</Text>
          ) : null}
        </View>

        <View style={styles.mysteryCard}>
          <View style={styles.mysteryHeader}>
            <View style={styles.mysteryHeaderText}>
              <Text style={styles.sectionTitle}>Mystery Finder</Text>
              <Text style={styles.mysterySubtitle}>Use the live ID tool, then review your recent observations here.</Text>
            </View>
            <TouchableOpacity
              style={styles.mysteryLaunchButton}
              onPress={() => router.push({ pathname: '/trail/field-id', params: { fromTrail: '1' } })}
            >
              <Text style={styles.mysteryLaunchButtonText}>Open</Text>
            </TouchableOpacity>
          </View>
          {mysteryLogs.length > 0 ? (
            mysteryLogs.map((log) => (
              <View key={log.id} style={styles.mysteryLogRow}>
                <View style={styles.mysteryLogBody}>
                  <Text style={styles.mysteryLogDate}>
                    {new Date(log.date).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.mysteryLogMeta}>
                    {log.overallForm || 'Observation'}{log.colorPrimary ? ` · ${log.colorPrimary}` : ''}
                  </Text>
                  {log.locationNote ? (
                    <Text style={styles.mysteryLogLocation} numberOfLines={1}>
                      {log.locationNote}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.mysteryLogMatches}>
                  {log.suggestedMushroomIds.length > 0 ? `${log.suggestedMushroomIds.length} match${log.suggestedMushroomIds.length === 1 ? '' : 'es'}` : 'No match'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.mysteryEmpty}>No mystery observations yet.</Text>
          )}
        </View>

        <RecentSightings
          observations={sightings}
          loading={sightingsLoading}
          onRetry={loadSightings}
          showError={sightingsError}
        />

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  header: {
    marginBottom: 14,
    paddingRight: 64,
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 10,
  },
  primaryAction: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
  },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryAction: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: { color: '#2d4a1a', fontWeight: '700', fontSize: 14 },
  habitatScroll: { marginBottom: 14 },
  habitatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#5a7a3a',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  habitatChipActive: { backgroundColor: '#5a7a3a' },
  habitatEmoji: { fontSize: 16, marginRight: 6 },
  habitatLabel: { color: '#5a7a3a', fontWeight: '700', fontSize: 13 },
  habitatLabelActive: { color: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2d4a1a' },
  speciesRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 10,
    marginTop: 10,
  },
  speciesThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e8f5d8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  speciesThumb: { width: '100%', height: '100%' },
  speciesFallback: { fontSize: 18, fontWeight: '700', color: '#5a7a3a' },
  speciesBody: { flex: 1 },
  speciesTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  speciesTitle: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', flex: 1, paddingRight: 8 },
  rarityChip: { fontSize: 11, fontWeight: '700' },
  speciesScientific: { fontSize: 12, color: '#8a8a7a', fontStyle: 'italic', marginTop: 2 },
  speciesNote: { fontSize: 12, color: '#5a5a4a', marginTop: 6 },
  rareWrap: { marginTop: 16 },
  rareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandText: { fontSize: 13, color: '#5a7a3a', fontWeight: '700' },
  rareHint: { fontSize: 13, color: '#8a8a7a', marginTop: 8 },
  strategyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginTop: 18,
  },
  strategyText: { fontSize: 14, color: '#2d4a1a', lineHeight: 21, marginTop: 10 },
  mysteryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginTop: 18,
  },
  mysteryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mysteryHeaderText: { flex: 1, paddingRight: 12 },
  mysterySubtitle: { fontSize: 13, color: '#8a8a7a', marginTop: 4, lineHeight: 18 },
  mysteryLaunchButton: {
    backgroundColor: '#e8f5d8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mysteryLaunchButtonText: { color: '#2d4a1a', fontWeight: '700', fontSize: 13 },
  mysteryLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef2e5',
  },
  mysteryLogBody: { flex: 1, paddingRight: 12 },
  mysteryLogDate: { fontSize: 12, color: '#8a8a7a', marginBottom: 4 },
  mysteryLogMeta: { fontSize: 14, color: '#2d4a1a', fontWeight: '700' },
  mysteryLogLocation: { fontSize: 12, color: '#5a5a4a', marginTop: 4 },
  mysteryLogMatches: { fontSize: 12, color: '#5a7a3a', fontWeight: '700' },
  mysteryEmpty: { fontSize: 13, color: '#8a8a7a' },
  bottomPad: { height: 24 },
  spotlightCard: {
    backgroundColor: '#fffaf0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0d9a6',
    padding: 16,
    marginBottom: 14,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spotlightThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e8f5d8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  spotlightThumb: {
    width: '100%',
    height: '100%',
  },
  spotlightHeaderText: {
    flex: 1,
  },
  spotlightName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d4a1a',
  },
  spotlightScientific: {
    fontSize: 12,
    color: '#8a8a7a',
    fontStyle: 'italic',
    marginTop: 2,
  },
  spotlightBody: {
    fontSize: 14,
    color: '#5a5a4a',
    lineHeight: 21,
  },
  spotlightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  spotlightExpandButton: {
    paddingVertical: 2,
    paddingLeft: 12,
  },
  spotlightExpandText: {
    fontSize: 12,
    color: '#5a7a3a',
    fontWeight: '700',
  },
  spotlightLabel: {
    fontSize: 11,
    color: '#8b6914',
    fontWeight: '700',
  },
  spotlightSkeleton: {
    gap: 10,
  },
  spotlightSkeletonBar: {
    height: 12,
    backgroundColor: '#f0e8d8',
    borderRadius: 6,
    width: '100%',
  },
  aiIndicator: {
    fontSize: 11,
    color: '#5a7a3a',
    fontWeight: '700',
    marginTop: 8,
  },
});

