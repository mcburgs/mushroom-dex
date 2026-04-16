import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import weeklyPool from '../../data/weekly-challenges.json';
import { auth, db } from '../firebase';
import { WeeklyChallenge, getStageForPoints } from '../types';

/** ISO-style week key, e.g. "2026-W15". Same value for all users in the same calendar week. */
export function getWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7,
  );
  return `${now.getFullYear()}-W${week}`;
}

/** Sunday midnight local time - the start of the current challenge window. */
export function getWeekStartDate(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay()); // back to Sunday
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Pick 3 challenges from the pool, rotating by week so they change every Sunday. */
export function getWeeklyChallenges(): WeeklyChallenge[] {
  const seed = getWeekKey()
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return [0, 1, 2].map((i) => weeklyPool[(seed + i) % weeklyPool.length] as WeeklyChallenge);
}

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function profileDoc(userId: string) {
  return doc(db, 'users', userId, 'profile', 'data');
}

function weeklyClaimsDoc(userId: string, weekKey: string) {
  return doc(db, 'users', userId, 'weeklyClaims', weekKey);
}

export async function getWeeklyCompleted(): Promise<string[]> {
  const userId = uid();
  if (!userId) return [];
  try {
    const snap = await getDoc(weeklyClaimsDoc(userId, getWeekKey()));
    if (!snap.exists()) return [];
    return (snap.data()?.completedIds as string[]) ?? [];
  } catch (error) {
    console.warn('[weeklyMissions] getWeeklyCompleted failed:', error);
    return [];
  }
}

export async function claimWeeklyChallengeWithPoints(
  challengeId: string,
  rewardPoints: number,
  weekKey: string
): Promise<{ awarded: boolean }> {
  const userId = uid();
  if (!userId) return { awarded: false };

  const claimsRef = weeklyClaimsDoc(userId, weekKey);
  const profRef = profileDoc(userId);

  try {
    const result = await runTransaction(db, async (tx) => {
      const claimsSnap = await tx.get(claimsRef);
      const profSnap = await tx.get(profRef);

      if (!profSnap.exists()) {
        throw new Error('User profile does not exist. Bootstrap required.');
      }

      const completedIds = (claimsSnap.data()?.completedIds as string[]) ?? [];
      if (completedIds.includes(challengeId)) {
        return { awarded: false };
      }

      const profile = profSnap.data() as any;
      const newPoints = (profile.totalPoints ?? 0) + rewardPoints;
      const newLevel = getStageForPoints(newPoints);

      tx.set(claimsRef, {
        completedIds: [...completedIds, challengeId],
        updatedAt: serverTimestamp()
      }, { merge: true });

      tx.update(profRef, {
        totalPoints: newPoints,
        level: newLevel
      });

      return { awarded: true };
    });
    return result;
  } catch (error) {
    console.warn('[weeklyMissions] claimWeeklyChallengeWithPoints failed:', error);
    return { awarded: false };
  }
}

