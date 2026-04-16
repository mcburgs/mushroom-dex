import {
  collection,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserFind, UserProfile } from '../types';
import { getFriends, FriendSummary } from './friends';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FriendFindEntry {
  find: UserFind;
  friend: FriendSummary;
}

export interface FriendsFindsIndex {
  /** Map from mushroomEntryId → list of friends who found it */
  bySpecies: Map<string, FriendSummary[]>;
  /** All friend finds, sorted by dateFound descending */
  allFinds: FriendFindEntry[];
  /** Timestamp when the index was built */
  builtAt: number;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let _profileCache: Map<string, UserProfile> = new Map();
let _findsCache: Map<string, UserFind[]> = new Map();
let _indexCache: FriendsFindsIndex | null = null;
let _cacheUid: string | null = null;

const INDEX_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function ensureCacheUid(): void {
  const currentUid = uid();
  if (_cacheUid !== currentUid) {
    _profileCache = new Map();
    _findsCache = new Map();
    _indexCache = null;
    _cacheUid = currentUid;
  }
}

export function clearFriendDataCache(): void {
  _profileCache = new Map();
  _findsCache = new Map();
  _indexCache = null;
  _cacheUid = null;
}

// ── Single-friend fetches ────────────────────────────────────────────────────

/**
 * Fetch a friend's full profile from Firestore.
 * Session-cached per friendUid.
 */
export async function getFriendProfile(
  friendUid: string,
  options: { force?: boolean } = {},
): Promise<UserProfile | null> {
  ensureCacheUid();
  if (!options.force && _profileCache.has(friendUid)) {
    return _profileCache.get(friendUid)!;
  }

  try {
    const snap = await getDoc(doc(db, 'users', friendUid, 'profile', 'data'));
    if (!snap.exists()) return null;
    const profile = snap.data() as UserProfile;
    _profileCache.set(friendUid, profile);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Fetch all of a friend's finds from Firestore.
 * Session-cached per friendUid.
 */
export async function getFriendFinds(
  friendUid: string,
  options: { force?: boolean } = {},
): Promise<UserFind[]> {
  ensureCacheUid();
  if (!options.force && _findsCache.has(friendUid)) {
    return _findsCache.get(friendUid)!;
  }

  try {
    const snap = await getDocs(collection(db, 'users', friendUid, 'finds'));
    const finds = snap.docs.map((d) => d.data() as UserFind);
    _findsCache.set(friendUid, finds);
    return finds;
  } catch {
    return [];
  }
}

// ── All-friends index ────────────────────────────────────────────────────────

/**
 * Build or return the cached index of all friends' finds.
 * Used by the Dex "found by friends" tag and the activity feed.
 *
 * Fetches all friends' finds in parallel (one Firestore read per friend).
 * Cached for 15 minutes; force-refresh with { force: true }.
 */
export async function getAllFriendsFindsIndex(
  options: { force?: boolean } = {},
): Promise<FriendsFindsIndex> {
  ensureCacheUid();

  if (
    !options.force &&
    _indexCache &&
    Date.now() - _indexCache.builtAt < INDEX_MAX_AGE_MS
  ) {
    return _indexCache;
  }

  const friends = await getFriends();
  if (friends.length === 0) {
    _indexCache = { bySpecies: new Map(), allFinds: [], builtAt: Date.now() };
    return _indexCache;
  }

  // Parallel fetch of all friends' finds
  const friendFindsArrays = await Promise.all(
    friends.map(async (friend) => {
      const finds = await getFriendFinds(friend.uid, { force: options.force });
      return { friend, finds };
    }),
  );

  const bySpecies = new Map<string, FriendSummary[]>();
  const allFinds: FriendFindEntry[] = [];

  for (const { friend, finds } of friendFindsArrays) {
    for (const find of finds) {
      // Build species → friends map
      const existing = bySpecies.get(find.mushroomEntryId) ?? [];
      if (!existing.some((f) => f.uid === friend.uid)) {
        existing.push(friend);
        bySpecies.set(find.mushroomEntryId, existing);
      }
      // Build all-finds list
      allFinds.push({ find, friend });
    }
  }

  // Sort all finds by date descending
  allFinds.sort(
    (a, b) =>
      new Date(b.find.dateFound).getTime() - new Date(a.find.dateFound).getTime(),
  );

  _indexCache = { bySpecies, allFinds, builtAt: Date.now() };
  return _indexCache;
}

/**
 * Get the cached index synchronously. Returns null if not yet built.
 */
export function getCachedFriendsFindsIndex(): FriendsFindsIndex | null {
  ensureCacheUid();
  if (!_indexCache) return null;
  if (Date.now() - _indexCache.builtAt > INDEX_MAX_AGE_MS) return null;
  return _indexCache;
}
