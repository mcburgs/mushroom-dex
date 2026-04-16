import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View, Alert, AppState } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileSheet from '../../src/components/ProfileSheet';
import { useProfile } from '../../src/context/ProfileContext';
import {
  getPendingInvitations,
  getUnseenResults,
  acceptChallenge,
  declineChallenge,
  claimConsolationPoints,
  expireStaleChallenges,
} from '../../src/storage/challenges';
import { auth } from '../../src/firebase';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

function ProfileTabIcon({ focused }: { focused: boolean }) {
  const { avatarUrl, displayName } = useProfile();
  const size = focused ? 28 : 24;
  const borderRadius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: size,
          height: size,
          borderRadius,
          borderWidth: focused ? 2 : 0,
          borderColor: '#5a7a3a',
          opacity: focused ? 1 : 0.65,
        }}
        contentFit="cover"
      />
    );
  }

  const initial = (displayName || '?')[0].toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: focused ? '#5a7a3a' : '#8a8a7a',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: focused ? 1 : 0.65,
      }}
    >
      <Text style={{ color: '#fff', fontSize: focused ? 13 : 11, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [profileOpen, setProfileOpen] = useState(false);
  const hasCheckedRef = useRef(false);

  const checkChallenges = useCallback(async () => {
    if (!auth.currentUser) return;

    // Expire stale challenges from previous weeks
    await expireStaleChallenges();

    // Check for pending invitations
    const pending = await getPendingInvitations();
    for (const challenge of pending) {
      Alert.alert(
        'Challenge!',
        `${challenge.initiatorName} challenged you to find ${challenge.targetMushroomName} this week! First to find it wins ${challenge.pointsAwarded} points.`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => declineChallenge(challenge.challengeId),
          },
          {
            text: 'Accept',
            onPress: () => acceptChallenge(challenge.challengeId),
          },
        ],
      );
      // Show one at a time — next will appear on next focus
      break;
    }

    // Check for unseen results (only if no pending to show)
    if (pending.length === 0) {
      const results = await getUnseenResults();
      for (const challenge of results) {
        const currentUid = auth.currentUser?.uid;
        const won = challenge.winnerId === currentUid;
        const opponentName =
          challenge.initiatorUid === currentUid
            ? challenge.inviteeName
            : challenge.initiatorName;

        if (won) {
          Alert.alert(
            'You Won!',
            `You found ${challenge.targetMushroomName} before ${opponentName}! +${challenge.pointsAwarded} points!`,
          );
        } else {
          Alert.alert(
            'Challenge Complete',
            `${opponentName} found ${challenge.targetMushroomName} first! +10 consolation points.`,
          );
          claimConsolationPoints(challenge.challengeId);
        }
        break;
      }
    }
  }, []);

  // Check on initial mount
  useEffect(() => {
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      // Delay slightly so the UI is rendered first
      const timer = setTimeout(checkChallenges, 1500);
      return () => clearTimeout(timer);
    }
  }, [checkChallenges]);

  // Check when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkChallenges();
      }
    });
    return () => subscription.remove();
  }, [checkChallenges]);
  const onProfileRoute = segments.includes('profile');

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#f9f6f0',
            borderTopColor: '#d4e8b8',
            borderTopWidth: 1,
            height: 56 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#5a7a3a',
          tabBarInactiveTintColor: '#8a8a7a',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="trail"
          options={{
            title: 'Trail',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🥾" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="dex"
          options={{
            title: 'Dex',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Collection',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🗂️" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="mystery"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="learn"
          options={{
            title: 'Learn',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🌿" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="missions"
          options={{
            title: 'Missions',
            tabBarIcon: ({ focused }) => <TabIcon emoji="⭐" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {!onProfileRoute ? (
        <View pointerEvents="box-none" style={[styles.avatarButtonWrap, { top: Math.max(insets.top, 8) + 6 }]}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => setProfileOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <ProfileTabIcon focused />
          </TouchableOpacity>
        </View>
      ) : null}

      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarButtonWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#d4e8b8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
