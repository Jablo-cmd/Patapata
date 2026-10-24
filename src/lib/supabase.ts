import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { config } from './config';
import type { Database } from './database.types';

// Placeholder values keep the module importable when the app is not yet
// configured; the root layout shows a setup screen in that case.
export const supabase = createClient<Database>(
  config.supabaseUrl || 'http://localhost:54321',
  config.supabaseAnonKey || 'not-configured',
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  },
);

// Refresh tokens only while the app is in the foreground (saves battery/data).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
