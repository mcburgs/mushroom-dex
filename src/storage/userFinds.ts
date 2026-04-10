import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserFind } from '../types';

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function findsCol(userId: string) {
  return collection(db, 'users', userId, 'finds');
}

function findDoc(userId: string, mushroomEntryId: string) {
  return doc(db, 'users', userId, 'finds', mushroomEntryId);
}

export async function getUserFinds(): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];
  try {
    const snap = await getDocs(findsCol(userId));
    return snap.docs.map((d) => d.data() as UserFind);
  } catch {
    return [];
  }
}

export async function addUserFind(find: UserFind): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];
  // Keyed by mushroomEntryId so each mushroom can only have one find
  await setDoc(findDoc(userId, find.mushroomEntryId), find);
  return getUserFinds();
}

export async function updateUserFind(
  id: string,
  changes: Partial<UserFind>
): Promise<UserFind[]> {
  const userId = uid();
  if (!userId) return [];
  // id is "find-{mushroomEntryId}-{timestamp}", extract mushroomEntryId
  const finds = await getUserFinds();
  const find = finds.find((f) => f.id === id);
  if (!find) return finds;
  await updateDoc(findDoc(userId, find.mushroomEntryId), changes);
  return getUserFinds();
}

export async function getFind(mushroomId: string): Promise<UserFind | null> {
  const userId = uid();
  if (!userId) return null;
  try {
    const snap = await getDoc(findDoc(userId, mushroomId));
    return snap.exists() ? (snap.data() as UserFind) : null;
  } catch {
    return null;
  }
}
