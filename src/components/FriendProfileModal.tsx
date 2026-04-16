import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { createChallenge } from '../storage/challenges';
import { buildForecast, HabitatOption, getEcologicalSeason } from '../utils/forecastEngine';
import { fetchWeatherSnapshot, buildNeutralWeatherSnapshot } from '../utils/weatherApi';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FriendSummary } from '../storage/friends';
import { getFriendProfile, getFriendFinds } from '../storage/friendData';
import { getCachedProfile } from '../storage/userProfile';
import { getCachedFinds } from '../storage/userFinds';
import { UserProfile, UserFind, MushroomEntry } from '../types';
import mushroomData from '../../data/mushrooms.json';

const MUSHROOMS = mushroomData as MushroomEntry[];
const MUSHROOM_BY_ID = new Map(MUSHROOMS.map((m) => [m.id, m]));

const LEVEL_EMOJI: Record<string, string> = {
  'Explorer': '🌱',
  'Tracker': '👣',
  'Observer': '👁️',
  'Naturalist': '🌿',
  'Field Expert': '🍄',
  'Mycologist': '🔬',
  'Master Mycologist': '🏆',
};

function daysAgo(dateStr: string | undefined): string {
  if (!dateStr) return 'No finds yet';
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

function bestFind(finds: UserFind[]): string {
  let best: MushroomEntry | null = null;
  let bestPoints = -1;
  for (const f of finds) {
    const entry = MUSHROOM_BY_ID.get(f.mushroomEntryId);
    if (entry && entry.pointsValue > bestPoints) {
      best = entry;
      bestPoints = entry.pointsValue;
    }
  }
  return best ? best.commonName : '—';
}

interface Props {
  visible: boolean;
  friend: FriendSummary | null;
  onClose: () => void;
}

export default function FriendProfileModal({ visible, friend, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finds, setFinds] = useState<UserFind[]>([]);

  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [bestBets, setBestBets] = useState<MushroomEntry[]>([]);
  const [loadingBets, setLoadingBets] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState(false);

  useEffect(() => {
    if (!visible || !friend) return;
    setLoading(true);
    Promise.all([
      getFriendProfile(friend.uid, { force: true }),
      getFriendFinds(friend.uid, { force: true }),
    ]).then(([p, f]) => {
      setProfile(p);
      setFinds(f);
      setLoading(false);
    });
  }, [visible, friend?.uid]);

  async function handleOpenChallengePicker() {
    setLoadingBets(true);
    setShowChallengePicker(true);
    try {
      const season = getEcologicalSeason();
      let weather;
      try {
        weather = await fetchWeatherSnapshot(season);
      } catch {
        weather = buildNeutralWeatherSnapshot(season);
      }
      const defaultHabitat: HabitatOption = {
        id: 'forest',
        label: 'Forest',
        emoji: '🌲',
        tags: ['forest', 'deciduous', 'coniferous', 'mixed'],
      };
      const forecast = buildForecast({
        weather,
        habitat: defaultHabitat,
        profile: myProfile ?? undefined,
      });
      setBestBets(forecast.bestBets.slice(0, 8));
    } catch {
      setBestBets([]);
    } finally {
      setLoadingBets(false);
    }
  }

  async function handleSendChallenge(target: MushroomEntry) {
    if (!friend || sendingChallenge) return;
    setSendingChallenge(true);
    try {
      await createChallenge(
        friend.uid,
        friend.displayName,
        target.id,
        target.commonName,
      );
      Alert.alert(
        'Challenge Sent!',
        `You challenged ${friend.displayName} to find ${target.commonName} this week!`,
      );
      setShowChallengePicker(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send challenge.');
    } finally {
      setSendingChallenge(false);
    }
  }

  if (!friend) return null;

  const myProfile = getCachedProfile();
  const myFinds = getCachedFinds() ?? [];

  const friendLevel = profile?.level ?? friend.level;
  const friendPoints = profile?.totalPoints ?? friend.totalPoints;
  const friendBadges = profile?.unlockedBadges?.length ?? 0;
  const friendLastFind = profile?.lastFindDate;
  const friendFindsCount = finds.length || friend.findsCount;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#5a7a3a" />
              <Text style={styles.loadingText}>Loading profile…</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {/* Avatar + Name */}
              <View style={styles.avatarSection}>
                {friend.avatarUrl ? (
                  <Image
                    source={{ uri: friend.avatarUrl }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                      {(friend.displayName ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.name}>{friend.displayName}</Text>
                <Text style={styles.levelBadge}>
                  {LEVEL_EMOJI[friendLevel] ?? '🌱'} {friendLevel}
                </Text>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{friendPoints}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{friendFindsCount}</Text>
                  <Text style={styles.statLabel}>Finds</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{friendBadges}</Text>
                  <Text style={styles.statLabel}>Badges</Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Best Find</Text>
                  <Text style={styles.detailValue}>{bestFind(finds)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Active</Text>
                  <Text style={styles.detailValue}>{daysAgo(friendLastFind)}</Text>
                </View>
              </View>

              {/* Head-to-Head */}
              {myProfile && (
                <View style={styles.h2hCard}>
                  <Text style={styles.h2hTitle}>Head to Head</Text>
                  <View style={styles.h2hRow}>
                    <View style={styles.h2hSide}>
                      <Text style={styles.h2hValue}>{myProfile.totalPoints}</Text>
                      <Text style={styles.h2hLabel}>Your pts</Text>
                    </View>
                    <Text style={styles.h2hVs}>vs</Text>
                    <View style={styles.h2hSide}>
                      <Text style={styles.h2hValue}>{friendPoints}</Text>
                      <Text style={styles.h2hLabel}>Their pts</Text>
                    </View>
                  </View>
                  <View style={styles.h2hRow}>
                    <View style={styles.h2hSide}>
                      <Text style={styles.h2hValue}>{myFinds.length}</Text>
                      <Text style={styles.h2hLabel}>Your finds</Text>
                    </View>
                    <Text style={styles.h2hVs}>vs</Text>
                    <View style={styles.h2hSide}>
                      <Text style={styles.h2hValue}>{friendFindsCount}</Text>
                      <Text style={styles.h2hLabel}>Their finds</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  onClose();
                  router.push(`/friend/${friend.uid}/collection`);
                }}
              >
                <Text style={styles.actionButtonText}>View Collection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.challengeButton]}
                onPress={handleOpenChallengePicker}
              >
                <Text style={styles.actionButtonText}>
                  Challenge to Mushroom of the Week
                </Text>
              </TouchableOpacity>

              {showChallengePicker && (
                <View style={styles.pickerCard}>
                  <Text style={styles.pickerTitle}>Pick a target species</Text>
                  <Text style={styles.pickerSubtitle}>
                    First to find it this week wins 150 points!
                  </Text>
                  {loadingBets ? (
                    <ActivityIndicator
                      size="small"
                      color="#5a7a3a"
                      style={{ marginVertical: 16 }}
                    />
                  ) : bestBets.length === 0 ? (
                    <Text style={styles.pickerEmpty}>
                      No species available for this week's conditions.
                    </Text>
                  ) : (
                    bestBets.map((bet) => (
                      <TouchableOpacity
                        key={bet.id}
                        style={styles.betRow}
                        onPress={() => handleSendChallenge(bet)}
                        disabled={sendingChallenge}
                      >
                        <Text style={styles.betName}>{bet.commonName}</Text>
                        <Text style={styles.betRarity}>{bet.rarityTier}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f9f6f0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: 300,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d4d4c4',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: '#5a5a4a', fontWeight: '700' },
  loadingBox: { alignItems: 'center', padding: 48 },
  loadingText: { fontSize: 14, color: '#8a8a7a', marginTop: 12 },
  content: { paddingHorizontal: 20 },

  // Avatar section
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#5a7a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: '#2d4a1a', marginBottom: 4 },
  levelBadge: { fontSize: 15, color: '#5a7a3a', fontWeight: '600' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#2d4a1a' },
  statLabel: { fontSize: 11, color: '#8a8a7a', marginTop: 2 },

  // Detail card
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginBottom: 12,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailLabel: { fontSize: 14, color: '#8a8a7a' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#2d4a1a' },
  divider: { height: 1, backgroundColor: '#f0f0e8', marginLeft: 16 },

  // Head to head
  h2hCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 16,
  },
  h2hTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d4a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  h2hSide: { flex: 1, alignItems: 'center' },
  h2hValue: { fontSize: 20, fontWeight: '800', color: '#2d4a1a' },
  h2hLabel: { fontSize: 11, color: '#8a8a7a', marginTop: 2 },
  h2hVs: { fontSize: 14, color: '#8a8a7a', fontWeight: '600', marginHorizontal: 8 },

  // Action buttons
  actionButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  challengeButton: {
    backgroundColor: '#8b6914',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 4,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: '#8a8a7a',
    marginBottom: 12,
  },
  pickerEmpty: {
    fontSize: 14,
    color: '#8a8a7a',
    textAlign: 'center',
    paddingVertical: 12,
  },
  betRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0e8',
  },
  betName: { fontSize: 15, fontWeight: '600', color: '#2d4a1a', flex: 1 },
  betRarity: { fontSize: 12, color: '#8b6914', fontWeight: '600' },
});
