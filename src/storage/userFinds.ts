import {
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
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserFind, UserProfile, getStageForPoints } from '../types';
import { processPhotosForUpload } from '../utils/photoUpload';
import { checkChallengeWin } from './challenges';

/** In-memory cache - survives navigation, cleared on app restart or sign-out. */
let _cache: UserFind[] | null = null;
let _cacheUid: string | null = null;

export function getCachedFinds(): UserFind[] | null {
  const userId = uid();
  if (!userId || !_cache || _cacheUid !== userId) return null;
  return [..._cache];
}

export function clearFindsCache(): void {
  _cache = null;
  _cacheUid = null;
}

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function findsCol(userId: string) {
  return collection(db, 'users', userId, 'finds');
}

function findDoc(userId: string, mushroomEntryId: string) {
  return doc(db, 'users', userId, 'finds', mushroomEntryId);
}

export async function getUserFinds(options: { force?: boolean } = {}): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];
  if (!options.force && _cache && _cacheUid === userId) return [..._cache];
  try {
    const snap = await getDocs(findsCol(userId));
    _cache = snap.docs.map((d) => d.data() as UserFind);
    _cacheUid = userId;
    return [..._cache];
  } catch {
    return [];
  }
}

/** Strip undefined values - Firestore rejects them. */
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function addUserFind(find: UserFind): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];

  // Upload any local photos to Firebase Storage
  let processedFind = { ...find };
  if (find.userPhotoPaths && find.userPhotoPaths.length > 0) {
    processedFind.userPhotoPaths = await processPhotosForUpload(
      userId,
      find.mushroomEntryId,
      find.userPhotoPaths,
    );
  }

  const clean = stripUndefined(processedFind);
  // Optimistic cache update.
  const base = _cacheUid === userId && _cache ? _cache : [];
  _cache = [...base.filter((f) => f.mushroomEntryId !== clean.mushroomEntryId), clean];
  _cacheUid = userId;
  await setDoc(findDoc(userId, clean.mushroomEntryId), clean);

  // Update lastFindDate on the user's profile
  try {
    await updateDoc(doc(db, 'users', userId, 'profile', 'data'), {
      lastFindDate: clean.dateFound,
    });
  } catch {
    // Non-critical — don't block find save
  }

  return [..._cache];
}

export async function addUserFindWithPoints(
  find: UserFind,
  points: number
): Promise<{ finds: UserFind[]; awarded: boolean }> {
  const userId = uid();
  if (!userId) return { finds: [], awarded: false };

  // Upload any local photos to Firebase Storage before writing to Firestore
  let processedFind = { ...find };
  if (find.userPhotoPaths && find.userPhotoPaths.length > 0) {
    processedFind.userPhotoPaths = await processPhotosForUpload(
      userId,
      find.mushroomEntryId,
      find.userPhotoPaths,
    );
  }
  const cleanFind = stripUndefined(processedFind);
  const mushroomId = cleanFind.mushroomEntryId;
  const findRef = findDoc(userId, mushroomId);
  const eventRef = doc(db, 'users', userId, 'rewardEvents', `find:${mushroomId}`);
  const profileRef = doc(db, 'users', userId, 'profile', 'data');

  let awarded = false;

  await runTransaction(db, async (tx) => {
    const eventSnap = await tx.get(eventRef);
    const profileSnap = await tx.get(profileRef);

    // Write find doc (explicitly requested: do it inside transaction)
    tx.set(findRef, cleanFind);

    if (!eventSnap.exists()) {
      awarded = true;
      const profileData = profileSnap.data() as Partial<UserProfile> | undefined;
      const currentPoints = profileData?.totalPoints ?? 0;
      const nextPoints = currentPoints + points;
      const nextLevel = getStageForPoints(nextPoints);

      if (profileSnap.exists()) {
        tx.update(profileRef, {
          totalPoints: increment(points),
          level: nextLevel,
          lastFindDate: cleanFind.dateFound,
        });
      } else {
        tx.set(profileRef, {
          name: auth.currentUser?.displayName ?? 'Explorer',
          level: nextLevel,
          totalPoints: nextPoints,
          unlockedBadges: [],
          completedMissions: [],
          completedLessons: [],
          preferences: {},
          avatarUrl: '',
          lastFindDate: cleanFind.dateFound,
        });
      }

      tx.set(eventRef, {
        reason: `First find of species: ${mushroomId}`,
        awardedAt: serverTimestamp(),
      });
    } else {
      awarded = false;
    }
  });

  // Optimistic cache update
  const base = _cacheUid === userId && _cache ? _cache : [];
  _cache = [...base.filter((f) => f.mushroomEntryId !== mushroomId), cleanFind];
  _cacheUid = userId;

  // Check if this find completes any active challenge (fire-and-forget)
  checkChallengeWin(mushroomId).catch((error) => {
    console.warn('[userFinds] Challenge win check failed:', error);
  });

  return { finds: [..._cache], awarded };
}

export async function updateUserFind(
  id: string,
  changes: Partial<UserFind>
): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];
  const finds = await getUserFinds();
  const find = finds.find((f) => f.id === id);
  if (!find) return finds;
  const cleanChanges = stripUndefined(changes);
  // Optimistic cache update.
  _cache = finds.map((f) => (f.id === id ? { ...f, ...cleanChanges } : f));
  _cacheUid = userId;
  await updateDoc(findDoc(userId, find.mushroomEntryId), cleanChanges);
  return [..._cache];
}

export async function getFind(mushroomId: string, options: { force?: boolean } = {}): Promise<UserFind | null> {
  const userId = uid();
  if (!userId) return null;
  // Check cache first - avoids Firestore reads and race conditions after optimistic deletes.
  if (!options.force && _cache && _cacheUid === userId) {
    return _cache.find((f) => f.mushroomEntryId === mushroomId) ?? null;
  }
  try {
    const snap = await getDoc(findDoc(userId, mushroomId));
    return snap.exists() ? (snap.data() as UserFind) : null;
  } catch {
    return null;
  }
}

export async function removeUserFind(id: string): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];
  const finds = await getUserFinds();
  const find = finds.find((item) => item.id === id);
  if (!find) return finds;
  // Optimistic cache update.
  _cache = finds.filter((item) => item.id !== id);
  _cacheUid = userId;
  await deleteDoc(findDoc(userId, find.mushroomEntryId));
  return [..._cache];
}

export async function getUserFindsNear(lat: number, lng: number, radiusKm: number, options: { force?: boolean } = {}): Promise<UserFind[]> {
  const finds = await getUserFinds(options);
  return finds.filter((find) => {
    if (typeof find.lat !== 'number' || typeof find.lng !== 'number') return false;
    const distance = haversineKm(lat, lng, find.lat, find.lng);
    return distance <= radiusKm;
  });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
