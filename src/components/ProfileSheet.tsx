import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { myFriendCode } from '../storage/friends';
import { getUserFinds } from '../storage/userFinds';
import { getUserProfile } from '../storage/userProfile';

type ProfileSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const LEVEL_EMOJI: Record<string, string> = {
  'Explorer':           '🌱',
  'Tracker':            '👣',
  'Observer':           '👁️',
  'Naturalist':         '🌿',
  'Field Expert':       '🍄',
  'Mycologist':         '🔬',
  'Master Mycologist':  '🏆',
};

function initials(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }

  return (email ?? '?')[0].toUpperCase();
}

export default function ProfileSheet({ visible, onClose }: ProfileSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { avatarUrl, displayName, refreshProfile } = useProfile();

  const [level, setLevel] = useState('Explorer');
  const [points, setPoints] = useState(0);
  const [findsCount, setFindsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let active = true;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        await refreshProfile();
        const [profile, finds] = await Promise.all([
          getUserProfile({ force: true }),
          getUserFinds({ force: true }),
        ]);
        if (!active) return;
        setLevel(profile.level);
        setPoints(profile.totalPoints);
        setFindsCount(finds.length);
      } catch (error) {
        console.warn('[ProfileSheet] Failed to refresh sheet stats:', error);
        if (!active) return;
        setLoadError('Could not refresh profile stats right now.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [visible, refreshProfile]);

  const resolvedName = displayName || user?.displayName || 'Explorer';
  const resolvedEmail = user?.email ?? '';
  const friendCode = useMemo(() => myFriendCode(), []);

  async function handleShareCode() {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      await Share.share({
        message: `Join me on FungiDex! Add me as a friend with code: ${friendCode}`,
      });
    } catch (error) {
      console.warn('[ProfileSheet] share code failed:', error);
      Alert.alert('Could not share code', 'Please try again.');
    } finally {
      setShareLoading(false);
    }
  }

  function handleOpenProfile() {
    onClose();
    router.push('/(tabs)/profile');
  }

  function handleManageFriends() {
    onClose();
    router.push('/(tabs)/profile');
  }

  async function handleSignOut() {
    if (signOutLoading) return;
    setSignOutLoading(true);
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.warn('[ProfileSheet] signOut failed:', error);
      Alert.alert('Could not sign out', 'Please try again.');
    } finally {
      setSignOutLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{initials(resolvedName, resolvedEmail)}</Text>
              </View>
            )}

            <View style={styles.headerText}>
              <Text style={styles.name}>{resolvedName}</Text>
              <Text style={styles.email}>{resolvedEmail}</Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#5a7a3a" />
                <Text style={styles.loadingText}>Refreshing profile stats...</Text>
              </View>
            ) : (
              <>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{LEVEL_EMOJI[level] ?? '🌱'}</Text>
                  <Text style={styles.statLabel}>{level}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{points}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{findsCount}</Text>
                  <Text style={styles.statLabel}>Finds</Text>
                </View>
              </>
            )}
          </View>
          {!loading && loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

          <View style={styles.codeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeLabel}>Friend code</Text>
              <Text style={styles.codeValue}>{friendCode}</Text>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={handleShareCode} disabled={shareLoading}>
              {shareLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.shareButtonText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryAction} onPress={handleOpenProfile}>
              <Text style={styles.primaryActionText}>Open full profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={handleManageFriends}>
              <Text style={styles.secondaryActionText}>Friends and leaderboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryAction, signOutLoading && styles.secondaryActionDisabled]}
              onPress={() => { void handleSignOut(); }}
              disabled={signOutLoading}
            >
              {signOutLoading ? (
                <ActivityIndicator size="small" color="#2d4a1a" />
              ) : (
                <Text style={styles.secondaryActionText}>Sign out</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 30, 18, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f9f6f0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#d4e8b8',
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d4d0c4',
    alignSelf: 'center',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarPlaceholder: {
    backgroundColor: '#5a7a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  name: {
    color: '#2d4a1a',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 2,
  },
  email: {
    color: '#7d7a68',
    fontSize: 14,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 88,
    marginBottom: 14,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#7d7a68',
    fontSize: 12,
    fontWeight: '600',
  },
  loadError: {
    color: '#8b3a14',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    color: '#2d4a1a',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#7d7a68',
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#eef0e5',
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 18,
    gap: 12,
  },
  codeLabel: {
    color: '#8a8a7a',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 6,
  },
  codeValue: {
    color: '#2d4a1a',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
  },
  shareButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  actions: {
    gap: 10,
  },
  primaryAction: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryActionDisabled: { opacity: 0.65 },
  secondaryActionText: {
    color: '#2d4a1a',
    fontSize: 15,
    fontWeight: '600',
  },
});
