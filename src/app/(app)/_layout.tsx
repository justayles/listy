import { Stack } from 'expo-router';
import type { ColorValue } from 'react-native';

import { ListyBrand } from '@/components/listy-brand';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

function ListyHeaderTitle({ tintColor }: { children: string; tintColor?: ColorValue }) {
  return <ListyBrand color={tintColor ?? undefined} />;
}

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
      <Stack.Screen
        name="lists"
        options={{ title: 'Listy', headerTitle: ListyHeaderTitle, headerTitleAlign: 'left' }}
      />
      <Stack.Screen name="list/[id]" options={{ title: '' }} />
      <Stack.Screen name="share/[id]" options={{ title: 'Share list' }} />
    </Stack>
  );
}
