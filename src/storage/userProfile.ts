import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, ProgressionStage, getStageForPoints } from '../types';

const KEY = 'user_profile';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Explorer',
  level: 'Explorer',
  totalPoints: 0,
  unlockedBadges: [],
  completedMissions: [],
  completedLessons: [],
  preferences: {},
};

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return JSON.parse(raw) as UserProfile;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export async function addPoints(points: number): Promise<UserProfile> {
  const profile = await getUserProfile();
  profile.totalPoints += points;
  profile.level = getStageForPoints(profile.totalPoints);
  await saveUserProfile(profile);
  return profile;
}

export async function markLessonComplete(lessonId: string): Promise<UserProfile> {
  const profile = await getUserProfile();
  if (!profile.completedLessons.includes(lessonId)) {
    profile.completedLessons = [...profile.completedLessons, lessonId];
    await saveUserProfile(profile);
  }
  return profile;
}
