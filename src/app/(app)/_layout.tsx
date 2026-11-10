import { Stack } from 'expo-router';

import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export default function AppLayout() {
  const theme = useTheme();
  const { session } = useAuth();
  useRealtimeSync(session?.user.id);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: listyFont.semibold, fontSize: 20 },
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="lists" options={{ title: 'Listy' }} />
      <Stack.Screen name="list/[id]" options={{ title: '' }} />
      <Stack.Screen name="share/[id]" options={{ title: 'Share list' }} />
    </Stack>
  );
}
