import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, getStageForPoints } from '../types';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Explorer',
  level: 'Explorer',
  totalPoints: 0,
  unlockedBadges: [],
  completedMissions: [],
  completedLessons: [],
  preferences: {},
};

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function profileDoc(userId: string) {
  return doc(db, 'users', userId, 'profile', 'data');
}

export async function getUserProfile(): Promise<UserProfile> {
  const userId = uid();
  if (!userId) return { ...DEFAULT_PROFILE };
  try {
    const snap = await getDoc(profileDoc(userId));
    if (!snap.exists()) return { ...DEFAULT_PROFILE };
    return snap.data() as UserProfile;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userId = uid();
  if (!userId) return;
  await setDoc(profileDoc(userId), profile);
}

export async function addPoints(points: number): Promise<UserProfile> {
  const profile = await getUserProfile();
  profile.totalPoints += points;
  profile.level = getStageForPoints(profile.totalPoints);
  await saveUserProfile(profile);
  return profile;
}

export async function completeMission(
  missionId: string,
  rewardPoints: number,
  badgeId: string | null,
): Promise<UserProfile> {
  const profile = await getUserProfile();
  if (profile.completedMissions.includes(missionId)) return profile;
  profile.completedMissions = [...profile.completedMissions, missionId];
  profile.totalPoints += rewardPoints;
  profile.level = getStageForPoints(profile.totalPoints);
  if (badgeId && !profile.unlockedBadges.includes(badgeId)) {
    profile.unlockedBadges = [...profile.unlockedBadges, badgeId];
  }
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
