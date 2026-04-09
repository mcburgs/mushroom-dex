import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'disclaimer_accepted';

export async function hasAcceptedDisclaimer(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function acceptDisclaimer(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}
