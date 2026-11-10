import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

/** Lands here if an email deep link opens the app. Codes are entered on /confirm. */
export default function AuthCallback() {
  const { session } = useAuth();
  const theme = useTheme();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (session) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, padding: 24 }}>
      {timedOut ? (
        <>
          <Text style={{ color: theme.text, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
            Could not finish from the email link. Enter the code from the email instead.
          </Text>
          <Link href="/confirm" style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>
            Enter code
          </Link>
        </>
      ) : (
        <ActivityIndicator size="large" color={theme.primary} />
      )}
    </View>
  );
}
