import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../firebase';

// Required for expo-auth-session to close the browser after redirect
WebBrowser.maybeCompleteAuthSession();

// ─── SETUP REQUIRED ──────────────────────────────────────────────────────────
// 1. Firebase Console → Authentication → Sign-in method → Google → enable it
// 2. Copy the "Web client ID" shown there (format: XXXXXX.apps.googleusercontent.com)
// 3. Paste it below
// 4. In Google Cloud Console → APIs & Services → Credentials → your Web client →
//    add the redirect URI printed in the console when you first open the sign-in screen
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID = 'REPLACE_WITH_WEB_CLIENT_ID';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });

  // Listen for auth state changes (handles app restart, token refresh, sign-out)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch(console.error);
    }
  }, [response]);

  async function signInWithGoogle() {
    // Log the redirect URI so you can add it to Google Cloud Console if needed
    if (request?.redirectUri) {
      console.log('[FungiDex] OAuth redirect URI:', request.redirectUri);
      console.log('[FungiDex] Add this to Google Cloud Console → Credentials → Web client → Authorized redirect URIs');
    }
    await promptAsync();
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
