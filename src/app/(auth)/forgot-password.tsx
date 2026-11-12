import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListyBrand } from '@/components/listy-brand';
import { Button, ErrorText, errorMessage } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export default function ForgotPassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
      router.push({ pathname: '/confirm', params: { email: email.trim(), type: 'recovery' } });
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
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled">
        <ListyBrand color={theme.text} style={styles.brand} />
        <Text style={[styles.title, { color: theme.text }]}>Forgot password</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Enter the email you signed up with. We will send a reset code to type back into Listy.
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          onSubmitEditing={() => email.trim() && !busy && submit()}
        />

        <ErrorText message={error} />
        {sent ? (
          <Text style={[styles.notice, { color: theme.success }]}>
            If that account exists, a reset code is on its way. Check spam, then enter the code on the next screen.
          </Text>
        ) : null}

        <Button
          title="Send reset link"
          onPress={submit}
          loading={busy}
          disabled={!email.trim()}
          style={{ marginTop: 16 }}
        />

        <Link href="/sign-in" replace style={[styles.link, { color: theme.primary }]}>
          Back to sign in
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { marginBottom: 10 },
  title: { fontSize: 22, fontFamily: listyFont.semibold },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 24, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  link: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  notice: { fontSize: 14, marginTop: 8, lineHeight: 20 },
});
