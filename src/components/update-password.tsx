import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { Button, ErrorText, errorMessage } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export function UpdatePassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}>
        <Text style={[styles.title, { color: theme.text }]}>Choose a new password</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          You opened a reset link. Set a password you can remember, then you can use the app.
        </Text>
        <PasswordInput
          placeholder="New password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          onSubmitEditing={() => password.length >= 6 && !busy && submit()}
        />
        <ErrorText message={error} />
        <Button
          title="Save password"
          onPress={submit}
          loading={busy}
          disabled={password.length < 6}
          style={{ marginTop: 16 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontFamily: listyFont.semibold },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 24 },
});
