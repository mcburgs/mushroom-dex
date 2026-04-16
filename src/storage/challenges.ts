import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Challenge, ChallengeStatus } from '../types';
import { getWeekKey } from './weeklyMissions';
import { awardPointsOnce } from './userProfile';

// ── Constants ────────────────────────────────────────────────────────────────

const CHALLENGE_POINTS_WINNER = 150;
const CHALLENGE_POINTS_CONSOLATION = 10;
const CHALLENGES_COL = 'challenges';

// ── Cache ────────────────────────────────────────────────────────────────────

let _cache: Challenge[] | null = null;
let _cacheUid: string | null = null;

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function getCachedChallenges(): Challenge[] | null {
  const currentUid = uid();
  if (!currentUid || _cacheUid !== currentUid) return null;
  return _cache ? [..._cache] : null;
}

export function clearChallengesCache(): void {
  _cache = null;
  _cacheUid = null;
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all challenges where the current user is either initiator or invitee.
 * Uses two queries (Firestore does not support OR on different fields).
 */
export async function getMyChallenges(
  options: { force?: boolean } = {},
): Promise<Challenge[]> {
  const currentUid = uid();
  if (!currentUid) return [];
  if (!options.force && _cache && _cacheUid === currentUid) return [..._cache];

  try {
    const [initiatorSnap, inviteeSnap] = await Promise.all([
      getDocs(query(collection(db, CHALLENGES_COL), where('initiatorUid', '==', currentUid))),
      getDocs(query(collection(db, CHALLENGES_COL), where('inviteeUid', '==', currentUid))),
    ]);

    const seen = new Set<string>();
    const challenges: Challenge[] = [];

    for (const snap of [initiatorSnap, inviteeSnap]) {
      for (const d of snap.docs) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        challenges.push({ ...(d.data() as Challenge), challengeId: d.id });
      }
    }

    _cache = challenges;
    _cacheUid = currentUid;
    return [..._cache];
  } catch {
    return [];
  }
}

/**
 * Get pending challenges that the current user has been invited to.
 */
export async function getPendingInvitations(): Promise<Challenge[]> {
  const challenges = await getMyChallenges();
  const currentUid = uid();
  return challenges.filter(
    (c) => c.status === 'pending' && c.inviteeUid === currentUid,
  );
}

/**
 * Get active challenges involving the current user.
 */
export async function getActiveChallenges(): Promise<Challenge[]> {
  const challenges = await getMyChallenges();
  return challenges.filter((c) => c.status === 'active');
}

/**
 * Get recently completed challenges where the user has not seen the result.
 * "Recently" = completed within the last 7 days.
 */
export async function getUnseenResults(): Promise<Challenge[]> {
  const challenges = await getMyChallenges();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return challenges.filter((c) => {
    if (c.status !== 'completed') return false;
    const resolvedTime = c.resolvedAt && typeof (c.resolvedAt as any).toMillis === 'function'
      ? (c.resolvedAt as any).toMillis()
      : typeof (c.resolvedAt as any).seconds === 'number'
        ? (c.resolvedAt as any).seconds * 1000
        : 0;
    return resolvedTime > sevenDaysAgo;
  });
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createChallenge(
  inviteeUid: string,
  inviteeName: string,
  targetMushroomId: string,
  targetMushroomName: string,
): Promise<string> {
  const currentUid = uid();
  if (!currentUid) throw new Error('Not signed in');

  const initiatorName =
    auth.currentUser?.displayName ?? 'Explorer';

  const challengeData = {
    weekKey: getWeekKey(),
    targetMushroomId,
    targetMushroomName,
    initiatorUid: currentUid,
    initiatorName,
    inviteeUid,
    inviteeName,
    status: 'pending' as ChallengeStatus,
    createdAt: serverTimestamp(),
    resolvedAt: null,
    winnerId: null,
    loserId: null,
    pointsAwarded: CHALLENGE_POINTS_WINNER,
    initiatorFoundAt: null,
    inviteeFoundAt: null,
  };

  const docRef = await addDoc(collection(db, CHALLENGES_COL), challengeData);
  // Invalidate cache
  _cache = null;
  return docRef.id;
}

// ── Accept / Decline ─────────────────────────────────────────────────────────

export async function acceptChallenge(challengeId: string): Promise<void> {
  await updateDoc(doc(db, CHALLENGES_COL, challengeId), {
    status: 'active',
  });
  _cache = null;
}

export async function declineChallenge(challengeId: string): Promise<void> {
  await updateDoc(doc(db, CHALLENGES_COL, challengeId), {
    status: 'declined',
  });
  _cache = null;
}

// ── Win detection ────────────────────────────────────────────────────────────

/**
 * Called after a find is saved. Checks if the found species matches any
 * active challenge and, if so, marks the current user as the winner.
 *
 * Returns the completed challenge if a win occurred, or null.
 */
export async function checkChallengeWin(
  mushroomEntryId: string,
): Promise<Challenge | null> {
  const currentUid = uid();
  if (!currentUid) return null;

  const challenges = await getMyChallenges({ force: true });
  const match = challenges.find(
    (c) =>
      c.status === 'active' &&
      c.targetMushroomId === mushroomEntryId &&
      (c.initiatorUid === currentUid || c.inviteeUid === currentUid),
  );

  if (!match) return null;

  const isInitiator = match.initiatorUid === currentUid;
  const loserId = isInitiator ? match.inviteeUid : match.initiatorUid;

  const challengeRef = doc(db, CHALLENGES_COL, match.challengeId);

  await updateDoc(challengeRef, {
    status: 'completed',
    winnerId: currentUid,
    loserId,
    resolvedAt: serverTimestamp(),
    ...(isInitiator
      ? { initiatorFoundAt: serverTimestamp() }
      : { inviteeFoundAt: serverTimestamp() }),
  });

  // Award points to winner (idempotent)
  await awardPointsOnce(
    `challenge:${match.challengeId}:${currentUid}`,
    CHALLENGE_POINTS_WINNER,
    `Won challenge: ${match.targetMushroomName}`,
  );

  // Award consolation points to loser (idempotent)
  // Note: this writes to the winner's reward events since we can't write
  // to another user's subcollection. The loser's points are awarded when
  // they next open the app and see the result.

  _cache = null;
  return { ...match, status: 'completed', winnerId: currentUid, loserId };
}

/**
 * Award consolation points to the current user for a challenge they lost.
 * Called when they view the result.
 */
export async function claimConsolationPoints(challengeId: string): Promise<void> {
  const currentUid = uid();
  if (!currentUid) return;
  await awardPointsOnce(
    `challenge:${challengeId}:${currentUid}:consolation`,
    CHALLENGE_POINTS_CONSOLATION,
    'Challenge consolation points',
  );
}

// ── Expiry ───────────────────────────────────────────────────────────────────

/**
 * Expire any stale challenges (pending or active) from previous weeks.
 * Called on app focus.
 */
export async function expireStaleChallenges(): Promise<number> {
  const currentWeek = getWeekKey();
  const challenges = await getMyChallenges({ force: true });
  let expired = 0;

  for (const c of challenges) {
    if (
      (c.status === 'pending' || c.status === 'active') &&
      c.weekKey !== currentWeek
    ) {
      try {
        await updateDoc(doc(db, CHALLENGES_COL, c.challengeId), {
          status: 'expired',
          resolvedAt: serverTimestamp(),
        });
        expired++;
      } catch {
        // Best-effort
      }
    }
  }

  if (expired > 0) _cache = null;
  return expired;
}
