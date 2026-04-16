import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: Firebase API keys for web apps are safe to commit — security is
// enforced through Firestore rules, not the key itself.
const firebaseConfig = {
  apiKey: 'AIzaSyCkvwh-r80959NCtnjRBtDslCi-5UaFkwE',
  authDomain: 'fungidex-9293a.firebaseapp.com',
  projectId: 'fungidex-9293a',
  storageBucket: 'fungidex-9293a.firebasestorage.app',
  messagingSenderId: '330876802972',
  appId: '1:330876802972:web:e20c840b72d243e9cc5a59',
};

export const app = initializeApp(firebaseConfig);

// Persist auth state in AsyncStorage so users stay signed in between launches
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

