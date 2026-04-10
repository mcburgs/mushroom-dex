import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (mode === 'sign-up' && !displayName) { setError('Enter a name for this profile.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
    } catch (e: any) {
      console.log('[FungiDex] Auth error code:', e.code, e.message);
      const msg: Record<string, string> = {
        'auth/invalid-email':           'That email address isn\'t valid.',
        'auth/user-not-found':          'No account found for that email.',
        'auth/wrong-password':          'Incorrect password.',
        'auth/email-already-in-use':    'An account with that email already exists.',
        'auth/weak-password':           'Password must be at least 6 characters.',
        'auth/invalid-credential':      'Email or password is incorrect.',
        'auth/operation-not-allowed':   'Email/password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.',
        'auth/network-request-failed':  'Network error. Check your connection.',
        'auth/too-many-requests':       'Too many attempts. Try again later.',
      };
      setError(msg[e.code] ?? `Error: ${e.code ?? 'unknown'}`);

    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>🍄</Text>
          <Text style={styles.title}>FungiDex</Text>
          <Text style={styles.subtitle}>
            {mode === 'sign-in' ? 'Welcome back' : 'Create your profile'}
          </Text>

          {mode === 'sign-up' && (
            <TextInput
              style={styles.input}
              placeholder="Your name (e.g. Patrick)"
              placeholderTextColor="#b0b0a0"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#b0b0a0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#b0b0a0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>
                  {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); }}
          >
            <Text style={styles.switchText}>
              {mode === 'sign-in'
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  emoji: { fontSize: 72, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 16, color: '#5a7a3a', marginBottom: 8, textAlign: 'center', width: '100%' },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2d4a1a',
  },
  error: {
    color: '#c0392b',
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
  button: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  switchRow: { marginTop: 8, padding: 8 },
  switchText: { color: '#5a7a3a', fontSize: 14, fontWeight: '600' },
});
