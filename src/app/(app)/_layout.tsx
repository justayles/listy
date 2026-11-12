import { Stack } from 'expo-router';
import { Image, Text, View } from 'react-native';

import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

function ListyHeaderTitle() {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image source={require('../../../assets/images/icon.png')} style={{ width: 40, height: 40 }} />
      <Text
        style={{
          fontFamily: listyFont.semibold,
          fontSize: 18,
          color: theme.text,
          includeFontPadding: false,
          paddingBottom: 2,
        }}>
        Listy
      </Text>
    </View>
  );
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
