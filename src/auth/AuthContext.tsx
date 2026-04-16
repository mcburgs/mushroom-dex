import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';
import { clearFindsCache } from '../storage/userFinds';
import { clearMysteryLogsCache } from '../storage/mysteryLogs';
import { clearProfileCache, ensureUserProfileBootstrap } from '../storage/userProfile';
import { clearFriendDataCache } from '../storage/friendData';
import { clearChallengesCache } from '../storage/challenges';


type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  sendPasswordReset: () => Promise<void>;
  reauthenticateForDeletion: (password: string) => Promise<void>;
  deleteCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => {},
  sendPasswordReset: async () => {},
  reauthenticateForDeletion: async () => {},
  deleteCurrentUser: async () => {},
});

function clearUserScopedState() {
  clearProfileCache();
  clearFindsCache();
  clearMysteryLogsCache();
  clearFriendDataCache();
  clearChallengesCache();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const nextUid = u?.uid ?? null;
      const previousUid = previousUidRef.current;
      const uidChanged = previousUid !== nextUid;

      if (uidChanged) {
        clearUserScopedState();
      }

      previousUidRef.current = nextUid;
      setUser(u);
      setLoading(false);

      if (uidChanged && u) {
        ensureUserProfileBootstrap(u.uid, u.displayName ?? undefined).catch((error) => {
          console.error('[AuthContext] Failed to bootstrap profile/public code for uid:', u.uid, error);
        });
      }
    });
    return unsub;
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async function signUp(email: string, password: string, displayName: string) {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
  }

  async function signOut() {
    clearUserScopedState();
    await firebaseSignOut(auth);
  }

  async function updateDisplayName(name: string) {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    setUser({ ...auth.currentUser });
  }

  async function sendPasswordReset() {
    if (!auth.currentUser?.email) return;
    await sendPasswordResetEmail(auth, auth.currentUser.email);
  }

  async function reauthenticateForDeletion(password: string) {
    if (!auth.currentUser?.email) return;
    const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, cred);
  }

  async function deleteCurrentUser() {
    if (!auth.currentUser) return;
    await deleteUser(auth.currentUser);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      updateDisplayName,
      sendPasswordReset,
      reauthenticateForDeletion,
      deleteCurrentUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
