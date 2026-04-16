import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { getUserProfile } from '../storage/userProfile';

// Per-user key so switching accounts doesn't show the wrong avatar
const avatarKey = (uid: string) => `@fungidex:avatar:${uid}`;

type ProfileCtx = {
  avatarUrl: string;
  displayName: string;
  refreshProfile: () => Promise<void>;
  cacheAvatar: (dataUrl: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileCtx>({
  avatarUrl: '',
  displayName: '',
  refreshProfile: async () => {},
  cacheAvatar: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState('');

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setAvatarUrl('');
      setDisplayName('');
      return;
    }

    // Show cached avatar instantly — no network needed
    const cached = await AsyncStorage.getItem(avatarKey(user.uid)).catch(() => null);
    if (cached) setAvatarUrl(cached);

    // Sync from Firestore in the background
    try {
      const p = await getUserProfile({ force: true });
      setDisplayName(user.displayName ?? p.name ?? '');
      if (p.avatarUrl && p.avatarUrl !== cached) {
        setAvatarUrl(p.avatarUrl);
        await AsyncStorage.setItem(avatarKey(user.uid), p.avatarUrl);
      }
    } catch {
      // Network unavailable — cached value is still shown
    }
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const cacheAvatar = useCallback(async (dataUrl: string) => {
    if (!user) return;
    setAvatarUrl(dataUrl);
    await AsyncStorage.setItem(avatarKey(user.uid), dataUrl);
  }, [user]);

  return (
    <ProfileContext.Provider value={{ avatarUrl, displayName, refreshProfile, cacheAvatar }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
