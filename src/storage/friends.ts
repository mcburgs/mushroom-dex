import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { friendCodeFromUid } from './userProfile';

export interface FriendSummary {
  uid: string;
  displayName: string;
  level: string;
  totalPoints: number;
  avatarUrl: string;
  findsCount: number;
  addedAt: string;
}

function myUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function myFriendCode(): string {
  const uid = myUid() ?? '';
  return friendCodeFromUid(uid);
}

export async function getFriends(): Promise<FriendSummary[]> {
  const uid = myUid();
  if (!uid) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'friends'));
    const friends = snap.docs.map((d) => d.data() as FriendSummary);
    return friends.sort((a, b) => b.totalPoints - a.totalPoints);
  } catch {
    return [];
  }
}

export async function addFriendByCode(code: string): Promise<FriendSummary> {
  const uid = myUid();
  if (!uid) throw new Error('Not signed in.');

  const normalized = code.trim().toUpperCase();
  if (normalized === myFriendCode()) throw new Error("That's your own code!");

  // Resolve code → UID via the public lookup collection
  const codeSnap = await getDoc(doc(db, 'userCodes', normalized));
  if (!codeSnap.exists()) throw new Error('No user found with that code. Check it and try again.');

  const { uid: friendUid } = codeSnap.data() as { uid: string };

  // Prevent duplicates
  const existing = await getDoc(doc(db, 'users', uid, 'friends', friendUid));
  if (existing.exists()) throw new Error('Already friends!');

  // Read their profile and finds count
  const [profileSnap, findsSnap] = await Promise.all([
    getDoc(doc(db, 'users', friendUid, 'profile', 'data')),
    getDocs(collection(db, 'users', friendUid, 'finds')),
  ]);

  const profile = profileSnap.exists() ? profileSnap.data() : {};

  const friend: FriendSummary = {
    uid: friendUid,
    displayName: profile.name ?? 'Explorer',
    level: profile.level ?? 'Explorer',
    totalPoints: profile.totalPoints ?? 0,
    avatarUrl: profile.avatarUrl ?? '',
    findsCount: findsSnap.size,
    addedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', uid, 'friends', friendUid), friend);
  return friend;
}

export async function removeFriend(friendUid: string): Promise<void> {
  const uid = myUid();
  if (!uid) return;
  await deleteDoc(doc(db, 'users', uid, 'friends', friendUid));
}

/** Re-fetch live stats for all friends and update cached docs. */
export async function refreshFriends(): Promise<FriendSummary[]> {
  const uid = myUid();
  if (!uid) return [];

  const friends = await getFriends();
  const updated = await Promise.all(
    friends.map(async (f) => {
      try {
        const [profileSnap, findsSnap] = await Promise.all([
          getDoc(doc(db, 'users', f.uid, 'profile', 'data')),
          getDocs(collection(db, 'users', f.uid, 'finds')),
        ]);
        if (!profileSnap.exists()) return f;
        const p = profileSnap.data();
        const refreshed: FriendSummary = {
          ...f,
          displayName: p.name ?? f.displayName,
          level: p.level ?? f.level,
          totalPoints: p.totalPoints ?? f.totalPoints,
          avatarUrl: p.avatarUrl ?? f.avatarUrl,
          findsCount: findsSnap.size,
        };
        await setDoc(doc(db, 'users', uid, 'friends', f.uid), refreshed);
        return refreshed;
      } catch {
        return f;
      }
    }),
  );

  return updated.sort((a, b) => b.totalPoints - a.totalPoints);
}
