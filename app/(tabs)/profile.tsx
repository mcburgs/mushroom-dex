import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../../src/auth/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { auth } from '../../src/firebase';
import {
  getUserProfile,
  getCachedProfile,
  updateUserProfileFields,
  saveUserProfile,
  clearAllUserData,
  deleteAllUserData,
} from '../../src/storage/userProfile';
import { getCachedFinds } from '../../src/storage/userFinds';
import {
  myFriendCode,
  getFriends,
  addFriendByCode,
  removeFriend,
  refreshFriends,
  FriendSummary,
} from '../../src/storage/friends';
import FriendProfileModal from '../../src/components/FriendProfileModal';

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? '?')[0].toUpperCase();
}

const LEVEL_EMOJI: Record<string, string> = {
  'Explorer':           '🌱',
  'Tracker':            '👣',
  'Observer':           '👁️',
  'Naturalist':         '🌿',
  'Field Expert':       '🍄',
  'Mycologist':         '🔬',
  'Master Mycologist':  '🏆',
};

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Row({
  label,
  value,
  onPress,
  destructive,
  loading,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={loading}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#5a7a3a" />
      ) : value ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : (
        <Text style={styles.rowChevron}>›</Text>
      )}
    </TouchableOpacity>
  );
}

// ── modal: edit name ──────────────────────────────────────────────────────────

function EditNameModal({
  visible,
  current,
  onSave,
  onClose,
}: {
  visible: boolean;
  current: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!value.trim()) { setError('Name cannot be empty.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSave(value.trim());
      onClose();
    } catch {
      setError('Failed to update name. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Name</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={setValue}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, loading && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalConfirmText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── modal: add friend ─────────────────────────────────────────────────────────

function AddFriendModal({
  visible,
  onAdd,
  onClose,
}: {
  visible: boolean;
  onAdd: (code: string) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    if (code.trim().length < 8) { setError('Codes are 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await onAdd(code.trim());
      setCode('');
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Could not add friend. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add Friend</Text>
          <Text style={styles.modalBody}>
            Enter your friend's 8-character code. They can find it from their profile menu.
          </Text>
          <TextInput
            style={[styles.modalInput, { letterSpacing: 3, textTransform: 'uppercase' }]}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. A1B2C3D4"
            placeholderTextColor="#b0b0a0"
            autoCapitalize="characters"
            maxLength={8}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setCode(''); setError(''); onClose(); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, loading && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalConfirmText}>Add</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── modal: delete account ─────────────────────────────────────────────────────

function DeleteModal({
  visible,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!password) { setError('Enter your password to confirm.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(password);
    } catch (e: any) {
      const msg: Record<string, string> = {
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-credential': 'Incorrect password.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      };
      setError(msg[e.code] ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Delete Account</Text>
          <Text style={styles.modalBody}>
            This permanently deletes your account and all data. This cannot be undone.{'\n\n'}
            Enter your password to confirm.
          </Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#b0b0a0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleDelete}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalDelete, loading && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalConfirmText}>Delete</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── friend card ───────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  rank,
  isMe,
  onRemove,
  onPress,
}: {
  friend: FriendSummary;
  rank: number;
  isMe: boolean;
  onRemove?: () => void;
  onPress?: () => void;
}) {
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress } : {};

  return (
    <Container {...containerProps} style={[styles.friendCard, isMe && styles.friendCardMe]}>
      <Text style={styles.friendRank}>{rankEmoji}</Text>
      {friend.avatarUrl ? (
        <Image
          source={{ uri: friend.avatarUrl }}
          style={styles.friendAvatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
          <Text style={styles.friendAvatarText}>
            {(friend.displayName ?? '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {friend.displayName}{isMe ? ' (you)' : ''}
        </Text>
        <Text style={styles.friendStats}>
          {LEVEL_EMOJI[friend.level] ?? '🌱'} {friend.level} · {friend.findsCount} finds
        </Text>
      </View>
      <Text style={styles.friendPoints}>{friend.totalPoints} pts</Text>
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={styles.friendRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.friendRemoveText}>✕</Text>
        </TouchableOpacity>
      )}
    </Container>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut, updateDisplayName, sendPasswordReset, reauthenticateForDeletion, deleteCurrentUser } = useAuth();
  const {
    avatarUrl: cachedAvatarUrl,
    displayName: cachedDisplayName,
    refreshProfile,
    cacheAvatar,
  } = useProfile();

  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendsRefreshing, setFriendsRefreshing] = useState(false);
  const [myPoints, setMyPoints] = useState(0);
  const [myFindsCount, setMyFindsCount] = useState(0);
  const [myLevel, setMyLevel] = useState('Explorer');

  const [editNameVisible, setEditNameVisible] = useState(false);
  const [addFriendVisible, setAddFriendVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendSummary | null>(null);

  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const displayName = cachedDisplayName || user?.displayName || '';
  const email = user?.email ?? '';
  const friendCode = myFriendCode();
  const resolvedAvatarUrl = avatarUrl || cachedAvatarUrl;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Sync cache read — instant render with last-known profile
      const cp = getCachedProfile();
      if (cp) { setAvatarUrl(cp.avatarUrl ?? ''); setMyPoints(cp.totalPoints); setMyLevel(cp.level); }
      const cf = getCachedFinds();
      if (cf) setMyFindsCount(cf.length);
      // Background network refresh
      refreshProfile().catch((error) => {
        console.warn('[Profile] refreshProfile failed on focus:', error);
      });
      getUserProfile({ force: true }).then((p) => {
        if (!active) return;
        setAvatarUrl(p.avatarUrl ?? '');
        setMyPoints(p.totalPoints);
        setMyLevel(p.level);
      });
      getFriends().then((f) => { if (active) setFriends(f); });
      // Also fetch my finds count for leaderboard row
      import('../../src/storage/userFinds').then(({ getUserFinds }) =>
        getUserFinds({ force: true }).then((f) => { if (active) setMyFindsCount(f.length); }),
      );
      return () => { active = false; };
    }, [refreshProfile]),
  );

  // ── avatar upload ────────────────────────────────────────────────────────────

  async function handlePickAvatar() {
    if (avatarUploading) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    setAvatarUploading(true);
    const previousAvatar = resolvedAvatarUrl;
    try {
      // 64×64 at 0.4 quality — ~2–4 KB, processes fast
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 64, height: 64 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const dataUrl = `data:image/jpeg;base64,${manipulated.base64}`;

      // Update UI and local cache immediately — no waiting for network
      setAvatarUrl(dataUrl);
      await cacheAvatar(dataUrl);

      // Sync to Firestore (for friends and cross-device)
      await updateUserProfileFields({ avatarUrl: dataUrl });
      await refreshProfile();
    } catch (e: any) {
      setAvatarUrl(previousAvatar);
      await cacheAvatar(previousAvatar ?? '');
      Alert.alert('Error', e.message ?? 'Could not save photo. Try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── friends ──────────────────────────────────────────────────────────────────

  async function handleRefreshFriends() {
    if (friendsRefreshing) return;
    setFriendsRefreshing(true);
    try {
      const updated = await refreshFriends();
      setFriends(updated);
    } catch (error) {
      console.warn('[Profile] refreshFriends failed:', error);
      Alert.alert('Could not refresh leaderboard', 'Please try again in a moment.');
    } finally {
      setFriendsRefreshing(false);
    }
  }

  async function handleAddFriend(code: string) {
    const newFriend = await addFriendByCode(code);
    setFriends((prev) =>
      [...prev, newFriend].sort((a, b) => b.totalPoints - a.totalPoints),
    );
  }

  function handleRemoveFriend(friend: FriendSummary) {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.displayName} from your leaderboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friend.uid);
              setFriends((prev) => prev.filter((f) => f.uid !== friend.uid));
            } catch (error) {
              console.warn('[Profile] removeFriend failed:', error);
              Alert.alert('Could not remove friend', 'Please try again.');
            }
          },
        },
      ],
    );
  }

  async function handleShareCode() {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      await Share.share({
        message: `Join me on FungiDex! Add me as a friend with code: ${friendCode}`,
      });
    } catch (error) {
      console.warn('[Profile] share code failed:', error);
      Alert.alert('Could not share code', 'Please try again.');
    } finally {
      setShareLoading(false);
    }
  }

  // ── account actions ──────────────────────────────────────────────────────────

  async function handleNameSave(name: string) {
    await updateDisplayName(name);
    await updateUserProfileFields({ name });
    await refreshProfile();
  }

  async function handlePasswordReset() {
    setResetLoading(true);
    try {
      await sendPasswordReset();
      setResetSent(true);
      Alert.alert('Email sent', `A password reset link has been sent to ${email}.`);
    } catch {
      Alert.alert('Error', 'Could not send reset email. Try again.');
    } finally {
      setResetLoading(false);
    }
  }

  function handleSignOut() {
    if (signOutLoading) return;
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSignOutLoading(true);
          try {
            await signOut();
          } catch (error) {
            console.warn('[Profile] signOut failed:', error);
            Alert.alert('Could not sign out', 'Please try again.');
          } finally {
            setSignOutLoading(false);
          }
        },
      },
    ]);
  }

  function handleClearData() {
    Alert.alert(
      'Clear All Data',
      'This deletes your entire collection, badges, points, and mission progress. Your account and photo stay. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearLoading(true);
            try {
              await clearAllUserData();
              
              // Remove user-scoped local keys to prevent state leakage
              const uid = auth.currentUser?.uid;
              if (uid) {
                await Promise.all([
                  AsyncStorage.removeItem(`@fungidex:avatar:${uid}`),
                  AsyncStorage.removeItem(`trail:lastHabitat:${uid}`),
                  AsyncStorage.removeItem(`trail:lastForecastPointsDate:${uid}`),
                  AsyncStorage.removeItem(`mystery_logs_${uid}`), // legacy
                  AsyncStorage.removeItem(`@fungidex:weeklyCompleted:${uid}`), // legacy
                ]);
              }

              setMyPoints(0);
              setMyFindsCount(0);
              Alert.alert('Cleared', 'All your progress has been reset.');
            } catch {
              Alert.alert('Error', 'Could not clear data. Try again.');
            } finally {
              setClearLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleDeleteAccount(password: string) {
    await reauthenticateForDeletion(password);
    await deleteAllUserData();
    await deleteCurrentUser();
    // AuthGate redirects to sign-in once user becomes null
  }

  // ── build leaderboard (me + friends merged, sorted by points) ────────────────

  const meSummary: FriendSummary = {
    uid: auth.currentUser?.uid ?? '',
    displayName: displayName || 'You',
    level: myLevel,
    totalPoints: myPoints,
    avatarUrl: resolvedAvatarUrl,
    findsCount: myFindsCount,
    addedAt: '',
  };

  const leaderboard = [meSummary, ...friends].sort((a, b) => b.totalPoints - a.totalPoints);

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={avatarUploading}>
            {resolvedAvatarUrl ? (
              <Image source={{ uri: resolvedAvatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(displayName, email)}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {avatarUploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.avatarBadgeText}>📷</Text>}
            </View>
          </TouchableOpacity>
          <Text style={styles.displayName}>{displayName || 'Explorer'}</Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        {/* Friend code */}
        <View style={styles.codeCard}>
          <View style={styles.codeLeft}>
            <Text style={styles.codeLabel}>Your Friend Code</Text>
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

        {/* Leaderboard */}
        <View style={styles.leaderboardHeader}>
          <Text style={[styles.sectionHeader, { marginTop: 0 }]}>Leaderboard</Text>
          <TouchableOpacity onPress={handleRefreshFriends} disabled={friendsRefreshing}>
            {friendsRefreshing
              ? <ActivityIndicator size="small" color="#5a7a3a" />
              : <Text style={styles.refreshText}>↻ Refresh</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {leaderboard.map((f, i) => {
            const isMe = f.uid === (auth.currentUser?.uid ?? '');
            return (
              <React.Fragment key={f.uid || 'me'}>
                {i > 0 && <View style={styles.divider} />}
                <FriendCard
                  friend={f}
                  rank={i + 1}
                  isMe={isMe}
                  onRemove={isMe ? undefined : () => handleRemoveFriend(f)}
                  onPress={isMe ? undefined : () => setSelectedFriend(f)}
                />
              </React.Fragment>
            );
          })}
        </View>

        <TouchableOpacity style={styles.addFriendButton} onPress={() => setAddFriendVisible(true)}>
          <Text style={styles.addFriendButtonText}>+ Add Friend by Code</Text>
        </TouchableOpacity>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <Row label="Display Name" value={displayName || '—'} onPress={() => setEditNameVisible(true)} />
          <View style={styles.divider} />
          <Row
            label={resetSent ? 'Reset Email Sent ✓' : 'Reset Password'}
            onPress={handlePasswordReset}
            loading={resetLoading}
          />
          <View style={styles.divider} />
          <Row label="Sign Out" onPress={handleSignOut} loading={signOutLoading} />
        </View>

        {/* Data */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <Row label="Clear All Data" onPress={handleClearData} destructive loading={clearLoading} />
        </View>

        {/* Danger */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.card}>
          <Row label="Delete Account" onPress={() => setDeleteVisible(true)} destructive />
        </View>

        <Text style={styles.footerNote}>
          Deleting your account permanently removes all data and cannot be reversed.
        </Text>
      </ScrollView>

      <EditNameModal
        visible={editNameVisible}
        current={displayName}
        onSave={handleNameSave}
        onClose={() => setEditNameVisible(false)}
      />
      <AddFriendModal
        visible={addFriendVisible}
        onAdd={handleAddFriend}
        onClose={() => setAddFriendVisible(false)}
      />
      <DeleteModal
        visible={deleteVisible}
        onConfirm={handleDeleteAccount}
        onClose={() => setDeleteVisible(false)}
      />
      <FriendProfileModal
        visible={!!selectedFriend}
        friend={selectedFriend}
        onClose={() => setSelectedFriend(null)}
      />
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#5a7a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2d4a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f9f6f0',
  },
  avatarBadgeText: { fontSize: 13 },
  displayName: { fontSize: 22, fontWeight: '700', color: '#2d4a1a', marginTop: 12, marginBottom: 4 },
  emailText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', width: '100%' },

  // Friend code
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
    marginBottom: 8,
  },
  codeLeft: { flex: 1 },
  codeLabel: { fontSize: 12, color: '#8a8a7a', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  codeValue: { fontSize: 24, fontWeight: '800', color: '#2d4a1a', letterSpacing: 4 },
  shareButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shareButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Leaderboard
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
    marginRight: 4,
  },
  refreshText: { fontSize: 13, color: '#5a7a3a', fontWeight: '600' },

  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  friendCardMe: { backgroundColor: '#f0f8e8' },
  friendRank: { fontSize: 20, width: 32, textAlign: 'center' },
  friendAvatar: { width: 40, height: 40, borderRadius: 20 },
  friendAvatarPlaceholder: {
    backgroundColor: '#5a7a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700', color: '#2d4a1a' },
  friendStats: { fontSize: 12, color: '#8a8a7a', marginTop: 1 },
  friendPoints: { fontSize: 15, fontWeight: '800', color: '#5a7a3a' },
  friendRemove: { paddingLeft: 8 },
  friendRemoveText: { fontSize: 14, color: '#c0c0b0', fontWeight: '700' },

  addFriendButton: {
    borderWidth: 1.5,
    borderColor: '#5a7a3a',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  addFriendButtonText: { color: '#5a7a3a', fontSize: 15, fontWeight: '700' },

  // Settings rows
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a8a7a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#f0f0e8', marginLeft: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
  },
  rowLabel: { flex: 1, fontSize: 16, color: '#2d4a1a' },
  rowLabelDestructive: { color: '#c0392b' },
  rowValue: { fontSize: 15, color: '#8a8a7a', maxWidth: 160, textAlign: 'right' },
  rowChevron: { fontSize: 22, color: '#c0c0b0' },

  footerNote: {
    fontSize: 12,
    color: '#b0b0a0',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#2d4a1a', marginBottom: 12 },
  modalBody: { fontSize: 14, color: '#5a5a4a', lineHeight: 20, marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f9f6f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2d4a1a',
    marginBottom: 8,
  },
  modalError: { fontSize: 13, color: '#c0392b', marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#5a7a3a', fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#5a7a3a',
    alignItems: 'center',
  },
  modalDelete: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#c0392b',
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f6f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2d4a1a',
  },
  eyeButton: { paddingHorizontal: 12, paddingVertical: 12 },
});
