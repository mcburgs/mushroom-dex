import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
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
  avatarUrl: '',
};

/**
 * In-memory profile cache.
 * Survives navigation within a session; cleared on app restart or sign-out.
 * Allows all screens to read profile data instantly without a Firestore round-trip.
 */
let _cache: UserProfile | null = null;
let _cacheUid: string | null = null;

/** Synchronous cache read - returns the in-memory profile without any network call. */
export function getCachedProfile(): UserProfile | null {
  const userId = uid();
  if (!userId || !_cache || _cacheUid !== userId) return null;
  return { ..._cache };
}

/** Wipe the cache (call on sign-out so the next user gets a fresh fetch). */
export function clearProfileCache(): void {
  _cache = null;
  _cacheUid = null;
}

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function profileDoc(userId: string) {
  return doc(db, 'users', userId, 'profile', 'data');
}

function defaultProfile(preferredName?: string): UserProfile {
  const trimmed = preferredName?.trim();
  return {
    ...DEFAULT_PROFILE,
    name: trimmed && trimmed.length > 0 ? trimmed : DEFAULT_PROFILE.name,
  };
}

function normalizeProfile(data: Partial<UserProfile> | undefined, preferredName?: string): UserProfile {
  const fallback = defaultProfile(preferredName);
  if (!data) return fallback;
  return {
    ...fallback,
    ...data,
    totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : fallback.totalPoints,
    unlockedBadges: Array.isArray(data.unlockedBadges) ? data.unlockedBadges : fallback.unlockedBadges,
    completedMissions: Array.isArray(data.completedMissions) ? data.completedMissions : fallback.completedMissions,
    completedLessons: Array.isArray(data.completedLessons) ? data.completedLessons : fallback.completedLessons,
    preferences: data.preferences ?? fallback.preferences,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : fallback.avatarUrl,
  };
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'not-found';
}

/** Derive the public 8-character friend code from a UID. */
export function friendCodeFromUid(userId: string): string {
  return userId.slice(0, 8).toUpperCase();
}

/**
 * Write/update the public lookup entry so friends can find this user by code.
 * Stored at userCodes/{code} - readable by any authenticated user.
 */
async function registerPublicCode(userId: string, profile: UserProfile): Promise<void> {
  const code = friendCodeFromUid(userId);
  await setDoc(doc(db, 'userCodes', code), {
    uid: userId,
    name: profile.name,
    level: profile.level,
    totalPoints: profile.totalPoints,
    avatarUrl: profile.avatarUrl ?? '',
  });
}

export async function ensureUserProfileBootstrap(
  userIdArg?: string,
  preferredName?: string,
): Promise<UserProfile> {
  const userId = userIdArg ?? uid();
  if (!userId) throw new Error('Cannot bootstrap profile without an authenticated user.');

  const snap = await getDoc(profileDoc(userId));
  const profile = snap.exists()
    ? normalizeProfile(snap.data() as Partial<UserProfile>, preferredName ?? auth.currentUser?.displayName ?? undefined)
    : defaultProfile(preferredName ?? auth.currentUser?.displayName ?? undefined);

  if (!snap.exists()) {
    await setDoc(profileDoc(userId), profile);
  }

  _cache = { ...profile };
  _cacheUid = userId;

  try {
    await registerPublicCode(userId, profile);
  } catch (error) {
    console.error('[userProfile] Failed to register public code during bootstrap for uid:', userId, error);
    throw error;
  }

  return { ...profile };
}

export async function getUserProfile(options: { force?: boolean } = {}): Promise<UserProfile> {
  const userId = uid();
  if (!userId) return { ...DEFAULT_PROFILE };
  // Return cache immediately if populated - zero network latency for navigation.
  if (!options.force && _cache && _cacheUid === userId) return { ..._cache };
  try {
    const snap = await getDoc(profileDoc(userId));
    _cache = snap.exists()
      ? normalizeProfile(snap.data() as Partial<UserProfile>, auth.currentUser?.displayName ?? undefined)
      : defaultProfile(auth.currentUser?.displayName ?? undefined);
    _cacheUid = userId;
    return { ..._cache };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Patch a subset of profile fields. 
 * Use this for interactive edits like name or avatar updates.
 */
export async function updateUserProfileFields(
  patch: Partial<Pick<UserProfile, 'name' | 'avatarUrl' | 'preferences'>>
): Promise<UserProfile> {
  const userId = uid();
  if (!userId) throw new Error('Cannot update profile without an authenticated user.');

  const docRef = profileDoc(userId);
  try {
    await updateDoc(docRef, patch);
  } catch (error) {
    if (isNotFoundError(error)) {
      // If the doc doesn't exist, bootstrap it first then retry the partial update.
      await ensureUserProfileBootstrap(userId, auth.currentUser?.displayName ?? undefined);
      await updateDoc(docRef, patch);
    } else {
      throw error;
    }
  }

  // Merge patch into in-memory cache
  if (_cache && _cacheUid === userId) {
    _cache = { ..._cache, ...patch };
  } else {
    // If cache was empty or for a different user, refresh it fully
    await getUserProfile();
  }

  // If we changed fields that appear on the leaderboard, sync the public lookup record.
  if (patch.name !== undefined || patch.avatarUrl !== undefined) {
    if (_cache) {
      try {
        await registerPublicCode(userId, _cache);
      } catch (error) {
        console.error('[userProfile] Failed to register public code during updateUserProfileFields for uid:', userId, error);
      }
    }
  }

  return { ..._cache! };
}

/** @deprecated Internal/reset-only. Use updateUserProfileFields for interactive edits. */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userId = uid();
  if (!userId) return;
  // Update cache immediately so callers see the change without waiting for Firestore.
  _cache = { ...profile };
  _cacheUid = userId;
  await setDoc(profileDoc(userId), profile);
  try {
    await registerPublicCode(userId, profile);
  } catch (error) {
    console.error('[userProfile] Failed to register public code during save for uid:', userId, error);
  }
}

export async function addPoints(points: number): Promise<UserProfile> {
  const userId = uid();
  if (!userId) {
    const profile = await getUserProfile();
    profile.totalPoints += points;
    profile.level = getStageForPoints(profile.totalPoints);
    return profile;
  }

  const profileRef = profileDoc(userId);
  let nextProfile: UserProfile = defaultProfile(auth.currentUser?.displayName ?? undefined);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(profileRef);
    const base = snap.exists()
      ? normalizeProfile(snap.data() as Partial<UserProfile>, auth.currentUser?.displayName ?? undefined)
      : defaultProfile(auth.currentUser?.displayName ?? undefined);

    const nextTotalPoints = base.totalPoints + points;
    const nextLevel = getStageForPoints(nextTotalPoints);

    if (snap.exists()) {
      tx.update(profileRef, {
        totalPoints: increment(points),
        level: nextLevel,
      });
    } else {
      tx.set(profileRef, {
        ...base,
        totalPoints: nextTotalPoints,
        level: nextLevel,
      });
    }

    nextProfile = {
      ...base,
      totalPoints: nextTotalPoints,
      level: nextLevel,
    };
  });

  _cache = { ...nextProfile };
  _cacheUid = userId;

  try {
    await registerPublicCode(userId, nextProfile);
  } catch (error) {
    console.error('[userProfile] Failed to register public code during addPoints for uid:', userId, error);
  }

  return { ...nextProfile };
}

export async function awardPointsOnce(
  eventId: string,
  points: number,
  reason: string
): Promise<{ profile: UserProfile; awarded: boolean }> {
  const userId = uid();
  if (!userId) {
    const profile = await getUserProfile();
    return { profile, awarded: false };
  }

  const eventRef = doc(db, 'users', userId, 'rewardEvents', eventId);
  const existingEvent = await getDoc(eventRef);
  if (existingEvent.exists()) {
    const profile = await getUserProfile();
    return { profile, awarded: false };
  }

  const profileRef = profileDoc(userId);
  let updatedProfile: UserProfile | null = null;

  await runTransaction(db, async (tx) => {
    const pSnap = await tx.get(profileRef);
    const eSnap = await tx.get(eventRef);
    if (eSnap.exists()) return; // idempotent exit inside tx

    const current = pSnap.exists()
      ? normalizeProfile(pSnap.data() as Partial<UserProfile>, auth.currentUser?.displayName ?? undefined)
      : defaultProfile(auth.currentUser?.displayName ?? undefined);

    const newPoints = current.totalPoints + points;
    const newLevel = getStageForPoints(newPoints);

    if (pSnap.exists()) {
      tx.update(profileRef, {
        totalPoints: increment(points),
        level: newLevel,
      });
    } else {
      tx.set(profileRef, {
        ...current,
        totalPoints: newPoints,
        level: newLevel,
      });
    }

    tx.set(eventRef, { reason, awardedAt: serverTimestamp() });

    updatedProfile = {
      ...current,
      totalPoints: newPoints,
      level: newLevel,
    };
  });

  if (updatedProfile) {
    const profile = updatedProfile as UserProfile;
    _cache = { ...profile };
    _cacheUid = userId;
    try {
      await registerPublicCode(userId, profile);
    } catch (error) {
      console.error('[userProfile] awardPointsOnce: failed to register public code', error);
    }
    return { profile: { ...profile }, awarded: true };
  }

  const profile = await getUserProfile();
  return { profile, awarded: false };
}

export async function completeLessonWithPoints(
  lessonId: string,
  points: number
): Promise<{ profile: UserProfile; awarded: boolean }> {
  const userId = uid();
  if (!userId) {
    const profile = await getUserProfile();
    return { profile, awarded: false };
  }

  const profileRef = profileDoc(userId);
  let updatedProfile: UserProfile | null = null;
  let awarded = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(profileRef);
    const base = snap.exists()
      ? normalizeProfile(snap.data() as Partial<UserProfile>, auth.currentUser?.displayName ?? undefined)
      : defaultProfile(auth.currentUser?.displayName ?? undefined);

    const lessonCompRef = doc(db, 'users', userId, 'lessonCompletions', lessonId);
    
    if (base.completedLessons.includes(lessonId)) {
      awarded = false;
      return;
    }

    const nextTotalPoints = base.totalPoints + points;
    const nextLevel = getStageForPoints(nextTotalPoints);
    const nextCompletedLessons = [...base.completedLessons, lessonId];

    if (snap.exists()) {
      tx.update(profileRef, {
        completedLessons: arrayUnion(lessonId),
        totalPoints: increment(points),
        level: nextLevel,
      });
    } else {
      tx.set(profileRef, {
        ...base,
        completedLessons: nextCompletedLessons,
        totalPoints: nextTotalPoints,
        level: nextLevel,
      });
    }

    tx.set(lessonCompRef, { 
      lessonId, 
      completedAt: serverTimestamp() 
    });

    updatedProfile = {
      ...base,
      completedLessons: nextCompletedLessons,
      totalPoints: nextTotalPoints,
      level: nextLevel,
    };
    awarded = true;
  });

  if (updatedProfile) {
    const profile = updatedProfile as UserProfile;
    _cache = { ...profile };
    _cacheUid = userId;
    if (awarded) {
      try {
        await registerPublicCode(userId, profile);
      } catch (error) {
        console.error('[userProfile] completeLessonWithPoints: failed to register public code', error);
      }
    }
    return { profile: { ...profile }, awarded };
  }

  const profile = await getUserProfile();
  return { profile, awarded: false };
}

export async function completeMission(
  missionId: string,
  rewardPoints: number,
  badgeId: string | null,
): Promise<UserProfile> {
  const userId = uid();
  if (!userId) {
    const profile = await getUserProfile();
    if (profile.completedMissions.includes(missionId)) return profile;
    profile.completedMissions = [...profile.completedMissions, missionId];
    profile.totalPoints += rewardPoints;
    profile.level = getStageForPoints(profile.totalPoints);
    if (badgeId && !profile.unlockedBadges.includes(badgeId)) {
      profile.unlockedBadges = [...profile.unlockedBadges, badgeId];
    }
    return profile;
  }

  const profileRef = profileDoc(userId);
  let nextProfile: UserProfile = defaultProfile(auth.currentUser?.displayName ?? undefined);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(profileRef);
    const base = snap.exists()
      ? normalizeProfile(snap.data() as Partial<UserProfile>, auth.currentUser?.displayName ?? undefined)
      : defaultProfile(auth.currentUser?.displayName ?? undefined);

    if (base.completedMissions.includes(missionId)) {
      nextProfile = { ...base };
      return;
    }

    const nextTotalPoints = base.totalPoints + rewardPoints;
    const nextLevel = getStageForPoints(nextTotalPoints);
    const nextCompletedMissions = [...base.completedMissions, missionId];
    const nextBadges = badgeId && !base.unlockedBadges.includes(badgeId)
      ? [...base.unlockedBadges, badgeId]
      : [...base.unlockedBadges];

    if (snap.exists()) {
      const updatePayload: {
        completedMissions: ReturnType<typeof arrayUnion>;
        totalPoints: ReturnType<typeof increment>;
        level: UserProfile['level'];
        unlockedBadges?: ReturnType<typeof arrayUnion>;
      } = {
        completedMissions: arrayUnion(missionId),
        totalPoints: increment(rewardPoints),
        level: nextLevel,
      };

      if (badgeId) {
        updatePayload.unlockedBadges = arrayUnion(badgeId);
      }

      tx.update(profileRef, updatePayload);
    } else {
      tx.set(profileRef, {
        ...base,
        completedMissions: nextCompletedMissions,
        totalPoints: nextTotalPoints,
        level: nextLevel,
        unlockedBadges: nextBadges,
      });
    }

    nextProfile = {
      ...base,
      completedMissions: nextCompletedMissions,
      totalPoints: nextTotalPoints,
      level: nextLevel,
      unlockedBadges: nextBadges,
    };
  });

  _cache = { ...nextProfile };
  _cacheUid = userId;

  try {
    await registerPublicCode(userId, nextProfile);
  } catch (error) {
    console.error('[userProfile] Failed to register public code during completeMission for uid:', userId, error);
  }

  return { ...nextProfile };
}

export async function markLessonComplete(lessonId: string): Promise<UserProfile> {
  const userId = uid();
  if (!userId) {
    // Preserve existing behavior when unauthenticated: local no-op persistence with updated return shape.
    const profile = await getUserProfile();
    if (!profile.completedLessons.includes(lessonId)) {
      profile.completedLessons = [...profile.completedLessons, lessonId];
    }
    return profile;
  }

  const profileRef = profileDoc(userId);

  if (_cache && _cacheUid === userId && !_cache.completedLessons.includes(lessonId)) {
    _cache = { ..._cache, completedLessons: [..._cache.completedLessons, lessonId] };
  }

  try {
    await updateDoc(profileRef, {
      completedLessons: arrayUnion(lessonId),
    });
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await ensureUserProfileBootstrap(userId, auth.currentUser?.displayName ?? undefined);
    await updateDoc(profileRef, {
      completedLessons: arrayUnion(lessonId),
    });
  }

  clearProfileCache();
  const profile = await getUserProfile();

  try {
    await registerPublicCode(userId, profile);
  } catch (error) {
    console.error('[userProfile] Failed to register public code during markLessonComplete for uid:', userId, error);
  }

  return profile;
}

/**
 * Helper to delete all documents in a subcollection using write batches.
 * Limits each batch to 500 operations to satisfy Firestore constraints.
 */
async function deleteSubcollectionDocs(userId: string, subcollection: string): Promise<void> {
  const snap = await getDocs(collection(db, 'users', userId, subcollection));
  if (snap.empty) return;

  const docs = snap.docs;
  // Firestore writeBatch has a limit of 500 operations per batch.
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + 500);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function clearAllUserData(): Promise<void> {
  const userId = uid();
  if (!userId) return;

  /**
   * Sequential deletion of subcollections to keep failure scope narrow.
   * Recursive deletion is not supported by the client SDK.
   */
  await deleteSubcollectionDocs(userId, 'finds');
  await deleteSubcollectionDocs(userId, 'rewardEvents');
  await deleteSubcollectionDocs(userId, 'weeklyClaims');
  await deleteSubcollectionDocs(userId, 'mysteryLogs');
  await deleteSubcollectionDocs(userId, 'lessonCompletions');

  // Reset profile (keep avatarUrl).
  const current = await getUserProfile();
  const reset: UserProfile = { ...DEFAULT_PROFILE, avatarUrl: current.avatarUrl ?? '' };
  await setDoc(profileDoc(userId), reset);

  _cache = { ...reset };
  _cacheUid = userId;

  try {
    await registerPublicCode(userId, reset);
  } catch (error) {
    console.error('[userProfile] Failed to register public code during clearAllUserData for uid:', userId, error);
    throw error;
  }
}

export async function deleteAllUserData(): Promise<void> {
  const userId = uid();
  if (!userId) return;

  // Clear subcollections and reset profile doc first.
  await clearAllUserData();

  // friends is treated as a separate category from progress data in clearAllUserData,
  // but must be removed when the entire account is deleted.
  await deleteSubcollectionDocs(userId, 'friends');

  // Remove public code entry.
  const code = friendCodeFromUid(userId);
  try {
    await deleteDoc(doc(db, 'userCodes', code));
  } catch (error) {
    console.error('[userProfile] Failed to delete public code entry for uid:', userId, error);
    throw error;
  }
}

