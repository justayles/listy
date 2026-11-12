import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Text, useColorScheme, View } from 'react-native';

import { ListySplash } from '@/components/listy-splash';
import { UpdatePassword } from '@/components/update-password';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useListyFonts } from '@/lib/fonts';
import { supabaseConfigured } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();
// Native fade options are not available in Expo Go — the JS overlay handles that instead.
if (Constants.appOwnership !== 'expo') {
  SplashScreen.setOptions({ duration: 200, fade: true });
}

// Refetch stale data when the app returns to the foreground (also covers
// realtime events missed while the app was backgrounded).
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

function RootNavigator() {
  const { session, loading, passwordRecovery } = useAuth();
  const fontsReady = useListyFonts();
  const userId = session?.user.id;
  const colorScheme = useColorScheme();
  const [splashVisible, setSplashVisible] = useState(true);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } }),
  );

  // Never leak one user's cached data to the next user on the same device.
  useEffect(() => {
    queryClient.clear();
  }, [userId, queryClient]);

  return (
    <View style={{ flex: 1 }}>
      {!loading ? (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <StatusBar style={splashVisible ? 'dark' : 'auto'} />
            {passwordRecovery ? (
              <UpdatePassword />
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Protected guard={!!session}>
                  <Stack.Screen name="(app)" />
                </Stack.Protected>
                <Stack.Protected guard={!session}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
              </Stack>
            )}
          </ThemeProvider>
        </QueryClientProvider>
      ) : null}
      {splashVisible ? (
        <ListySplash
          ready={!loading && fontsReady}
          fontsReady={fontsReady}
          onFinished={() => setSplashVisible(false)}
        />
      ) : null}
    </View>
  );
}

function MissingConfig() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#123A48', marginBottom: 12 }}>
        Listy is missing its database settings
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: '#5B6E74' }}>
        This install was built without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY. Add
        those to the EAS preview environment and rebuild the APK.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  if (!supabaseConfigured) {
    return <MissingConfig />;
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
