import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';

export default function SignInScreen() {
  const { signInWithGoogle, loading } = useAuth();
  const [signingIn, setSigningIn] = React.useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🍄</Text>
        <Text style={styles.title}>FungiDex</Text>
        <Text style={styles.subtitle}>Your personal mushroom field guide</Text>

        <View style={styles.card}>
          <Text style={styles.cardText}>
            Sign in to save your finds and track your progress across devices.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.googleButton, (signingIn || loading) && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={signingIn || loading}
        >
          {signingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.fine}>
          Your data is saved to your Google account and synced across devices.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emoji: { fontSize: 80 },
  title: { fontSize: 36, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 16, color: '#5a7a3a', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    width: '100%',
    marginVertical: 8,
  },
  cardText: { fontSize: 15, color: '#3a3a2a', lineHeight: 22, textAlign: 'center' },
  googleButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  googleButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  fine: {
    fontSize: 12,
    color: '#8a8a7a',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
