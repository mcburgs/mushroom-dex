import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserFind } from '../types';

const KEY = 'user_finds';

export async function getUserFinds(): Promise<UserFind[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserFind[];
  } catch {
    return [];
  }
}

export async function saveUserFinds(finds: UserFind[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(finds));
}

export async function addUserFind(find: UserFind): Promise<UserFind[]> {
  const finds = await getUserFinds();
  // Replace existing find for the same mushroom, or add new
  const existingIndex = finds.findIndex(
    (f) => f.mushroomEntryId === find.mushroomEntryId
  );
  if (existingIndex >= 0) {
    finds[existingIndex] = find;
  } else {
    finds.push(find);
  }
  await saveUserFinds(finds);
  return finds;
}

export async function updateUserFind(
  id: string,
  changes: Partial<UserFind>
): Promise<UserFind[]> {
  const finds = await getUserFinds();
  const index = finds.findIndex((f) => f.id === id);
  if (index >= 0) {
    finds[index] = { ...finds[index], ...changes };
    await saveUserFinds(finds);
  }
  return finds;
}

export async function getFind(mushroomId: string): Promise<UserFind | null> {
  const finds = await getUserFinds();
  return finds.find((f) => f.mushroomEntryId === mushroomId) ?? null;
}
