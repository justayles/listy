import { Link, useLocalSearchParams } from 'expo-router';
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

import { Button, ErrorText, errorMessage } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export default function ConfirmEmail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { verifyEmailOtp, resendEmailOtp } = useAuth();
  const params = useLocalSearchParams<{ email?: string; type?: string }>();
  const isRecovery = params.type === 'recovery';
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && token.trim().length >= 6;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, token, isRecovery ? 'recovery' : 'signup');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      await resendEmailOtp(email, isRecovery ? 'recovery' : 'signup');
      setResent(true);
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
        <Text style={[styles.wordmark, { color: theme.primary }]}>Listy</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {isRecovery ? 'Enter reset code' : 'Confirm your email'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {isRecovery
            ? 'We sent a reset from noreply@bokeh.gallery (check spam). Tap Open Listy, or type the code here.'
            : 'We sent a message from noreply@bokeh.gallery (check spam). Tap Open Listy, or type the code here.'}
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
        />
        <TextInput
          style={[styles.input, styles.code, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Code from email"
          placeholderTextColor={theme.textMuted}
          value={token}
          onChangeText={(value) => setToken(value.replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={8}
          onSubmitEditing={() => canSubmit && !busy && submit()}
        />

        <ErrorText message={error} />
        {resent ? (
          <Text style={[styles.notice, { color: theme.success }]}>A new code is on the way. Check spam too.</Text>
        ) : null}

        <Button title="Continue" onPress={submit} loading={busy} disabled={!canSubmit} style={{ marginTop: 16 }} />
        <Button
          title="Resend code"
          variant="secondary"
          onPress={resend}
          disabled={!email.trim() || busy}
          style={{ marginTop: 12 }}
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
  wordmark: { fontSize: 40, fontFamily: listyFont.wordmark, marginBottom: 10, paddingBottom: 4 },
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
  code: { letterSpacing: 4, fontSize: 22, fontFamily: listyFont.semibold },
  link: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  notice: { fontSize: 14, marginTop: 8, lineHeight: 20 },
});
