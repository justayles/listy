import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/**
 * In local dev the Supabase URL points at 127.0.0.1, which a phone or emulator
 * can't reach. Swap in the dev machine's address (taken from the Expo dev
 * server URL) so Expo Go on a phone and the Android emulator both work.
 */
function resolveSupabaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!LOCAL_HOSTS.includes(url.hostname)) return rawUrl;

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost && !LOCAL_HOSTS.includes(devHost)) {
    url.hostname = devHost;
  } else if (Platform.OS === 'android') {
    // Android emulator's alias for the host machine.
    url.hostname = '10.0.2.2';
  }
  return url.toString().replace(/\/$/, '');
}

export const supabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_KEY,
);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://unconfigured.invalid';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'unconfigured';

export const supabase = createClient<Database>(
  supabaseConfigured ? resolveSupabaseUrl(supabaseUrl) : supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
