import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MysteryObservation, getStageForPoints } from '../types';

const legacyStorageKey = (userId: string) => `mystery_logs_${userId}`;

/** In-memory cache - survives navigation, cleared on app restart. */
let _cache: MysteryObservation[] | null = null;
let _cacheUid: string | null = null;

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function mysteryLogsColl(userId: string) {
  return collection(db, 'users', userId, 'mysteryLogs');
}

function profileDoc(userId: string) {
  return doc(db, 'users', userId, 'profile', 'data');
}

export function getCachedMysteryLogs(): MysteryObservation[] | null {
  const userId = uid();
  if (!userId || !_cache || _cacheUid !== userId) return null;
  return [..._cache];
}

export function clearMysteryLogsCache(): void {
  _cache = null;
  _cacheUid = null;
}

export async function getMysteryLogs(options: { force?: boolean } = {}): Promise<MysteryObservation[]> {
  const userId = uid();
  if (!userId) return [];
  if (!options.force && _cache && _cacheUid === userId) return [..._cache];

  try {
    // 1. Query Firestore
    const q = query(mysteryLogsColl(userId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    let logs = snap.docs.map((d) => d.data() as MysteryObservation);

    // 2. Migration Guard
    if (logs.length === 0) {
      const rawLegacy = await AsyncStorage.getItem(legacyStorageKey(userId));
      if (rawLegacy) {
        const legacyLogs = JSON.parse(rawLegacy) as MysteryObservation[];
        if (legacyLogs.length > 0) {
          const batch = writeBatch(db);
          legacyLogs.forEach((log) => {
            const ref = doc(db, 'users', userId, 'mysteryLogs', log.id);
            batch.set(ref, log);
          });
          await batch.commit();
          await AsyncStorage.removeItem(legacyStorageKey(userId));
          logs = legacyLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }
    }

    _cache = logs;
    _cacheUid = userId;
    return [...logs];
  } catch (error) {
    console.warn('[mysteryLogs] getMysteryLogs failed:', error);
    return [];
  }
}

/** @deprecated Use addMysteryLogWithPoints if points are involved. */
export async function addMysteryLog(log: MysteryObservation): Promise<MysteryObservation[]> {
  const userId = uid();
  if (!userId) return [];
  
  await setDoc(doc(db, 'users', userId, 'mysteryLogs', log.id), log);
  
  // Refresh cache
  _cache = null;
  return getMysteryLogs();
}

export async function addMysteryLogWithPoints(log: MysteryObservation, points: number): Promise<void> {
  const userId = uid();
  if (!userId) return;

  const eventId = `mystery:${log.id}`;
  const eventRef = doc(db, 'users', userId, 'rewardEvents', eventId);
  const logRef = doc(db, 'users', userId, 'mysteryLogs', log.id);
  const profRef = profileDoc(userId);

  await runTransaction(db, async (tx) => {
    // 1. Read event
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists()) return; // No-op if already awarded

    // 2. Read profile
    const profSnap = await tx.get(profRef);
    if (!profSnap.exists()) {
      throw new Error('User profile does not exist. Bootstrap required.');
    }
    const profile = profSnap.data() as any; // UserProfile

    // 3. Compute rewards
    const newPoints = (profile.totalPoints ?? 0) + points;
    const newLevel = getStageForPoints(newPoints);

    // 4. Atomic writes
    tx.set(logRef, log);
    tx.set(eventRef, {
      reason: 'Mystery observation completion',
      awardedAt: serverTimestamp(),
      points,
    });
    tx.update(profRef, {
      totalPoints: newPoints,
      level: newLevel,
    });
  });

  // Update local cache
  if (_cache && _cacheUid === userId) {
    _cache = [log, ..._cache];
  }
}

export async function updateMysteryLog(
  id: string,
  changes: Partial<MysteryObservation>
): Promise<MysteryObservation[]> {
  const userId = uid();
  if (!userId) return [];
  
  await updateDoc(doc(db, 'users', userId, 'mysteryLogs', id), changes);
  
  // Refresh cache
  _cache = null;
  return getMysteryLogs();
}

export async function removeMysteryLog(id: string): Promise<MysteryObservation[]> {
  const userId = uid();
  if (!userId) return [];

  await deleteDoc(doc(db, 'users', userId, 'mysteryLogs', id));

  if (_cache && _cacheUid === userId) {
    _cache = _cache.filter((log) => log.id !== id);
    return [..._cache];
  }
  return getMysteryLogs({ force: true });
}

