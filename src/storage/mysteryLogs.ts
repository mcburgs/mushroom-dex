import AsyncStorage from '@react-native-async-storage/async-storage';
import { MysteryObservation } from '../types';

const KEY = 'mystery_logs';

export async function getMysteryLogs(): Promise<MysteryObservation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MysteryObservation[];
  } catch {
    return [];
  }
}

export async function saveMysteryLogs(logs: MysteryObservation[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(logs));
}

export async function addMysteryLog(
  log: MysteryObservation
): Promise<MysteryObservation[]> {
  const logs = await getMysteryLogs();
  logs.unshift(log); // newest first
  await saveMysteryLogs(logs);
  return logs;
}

export async function updateMysteryLog(
  id: string,
  changes: Partial<MysteryObservation>
): Promise<MysteryObservation[]> {
  const logs = await getMysteryLogs();
  const index = logs.findIndex((l) => l.id === id);
  if (index >= 0) {
    logs[index] = { ...logs[index], ...changes };
    await saveMysteryLogs(logs);
  }
  return logs;
}
