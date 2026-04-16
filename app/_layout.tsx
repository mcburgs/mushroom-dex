import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { hasAcceptedDisclaimer, acceptDisclaimer } from '../src/storage/disclaimerAccepted';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { ProfileProvider } from '../src/context/ProfileContext';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5a7a3a',
    primaryContainer: '#d4e8b8',
    secondary: '#8b6914',
    secondaryContainer: '#f5e0a0',
    surface: '#f9f6f0',
    background: '#f9f6f0',
  },
};

function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  return (
    <Modal visible animationType="fade" transparent={false}>
      <SafeAreaView style={styles.disclaimerContainer}>
        <ScrollView contentContainerStyle={styles.disclaimerContent}>
          <Text style={styles.disclaimerEmoji}>🍄</Text>
          <Text style={styles.disclaimerTitle}>Welcome to FungiDex!</Text>
          <Text style={styles.disclaimerSubtitle}>Before we explore together</Text>
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              This app is a learning and collection guide. It helps you observe, compare, and log mushrooms — but it does not guarantee exact identification and does not tell you what is safe to eat.
            </Text>
            <Text style={styles.disclaimerText}>
              Never eat any mushroom based on this app or any app. Always involve a knowledgeable adult before touching or tasting any wild mushroom.
            </Text>
            <Text style={styles.disclaimerText}>
              FungiDex is about the joy of looking, learning, and discovering — not about foraging.
            </Text>
          </View>
          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Text style={styles.acceptButtonText}>I understand — let's explore!</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Handles auth-based routing: redirects to /sign-in if not signed in
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!user && !onSignIn) {
      router.replace('/sign-in');
    } else if (user && onSignIn) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f6f0' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🍄</Text>
        <ActivityIndicator color="#5a7a3a" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hasAcceptedDisclaimer().then((accepted) => {
      setShowDisclaimer(!accepted);
      setReady(true);
    });
  }, []);

  const handleAccept = async () => {
    await acceptDisclaimer();
    setShowDisclaimer(false);
  };

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <AuthProvider>
          <ProfileProvider>
          <AuthGate>
            {showDisclaimer && <DisclaimerModal onAccept={handleAccept} />}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen
                name="dex/[id]"
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerBackTitle: 'Dex',
                  headerStyle: { backgroundColor: '#f9f6f0' },
                  headerTintColor: '#5a7a3a',
                }}
              />
              <Stack.Screen
                name="learn/[id]"
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerBackTitle: 'Learn',
                  headerStyle: { backgroundColor: '#f9f6f0' },
                  headerTintColor: '#5a7a3a',
                }}
              />
              <Stack.Screen
                name="trail/field-id"
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerBackTitle: 'Trail',
                  headerStyle: { backgroundColor: '#f9f6f0' },
                  headerTintColor: '#5a7a3a',
                }}
              />
              <Stack.Screen
                name="friend/[uid]/collection"
                options={{
                  headerShown: true,
                  headerTitle: 'Collection',
                  headerBackTitle: 'Back',
                  headerStyle: { backgroundColor: '#f9f6f0' },
                  headerTintColor: '#5a7a3a',
                }}
              />
            </Stack>
          </AuthGate>
          </ProfileProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  disclaimerContainer: {
    flex: 1,
    backgroundColor: '#f9f6f0',
  },
  disclaimerContent: {
    padding: 24,
    alignItems: 'center',
  },
  disclaimerEmoji: {
    fontSize: 64,
    marginTop: 32,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2d4a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  disclaimerSubtitle: {
    fontSize: 16,
    color: '#5a7a3a',
    marginBottom: 24,
    textAlign: 'center',
  },
  disclaimerBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    width: '100%',
    marginBottom: 32,
  },
  disclaimerText: {
    fontSize: 15,
    color: '#3a3a2a',
    lineHeight: 22,
  },
  acceptButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
