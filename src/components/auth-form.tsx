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

import { PasswordInput } from '@/components/password-input';
import { Button, ErrorText, errorMessage } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { listyFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';
  const canSubmit = email.trim().length > 0 && password.length >= 6;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        const needsConfirm = await signUp(email, password, displayName);
        if (needsConfirm) {
          router.push({ pathname: '/confirm', params: { email: email.trim(), type: 'signup' } });
          return;
        }
      } else {
        await signIn(email, password);
      }
      // On success the session-gated layout redirects automatically.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.wordmark, { color: theme.primary }]}>Listy</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {isSignUp ? 'Create account' : 'Welcome back'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {isSignUp ? 'Sign up to start sharing lists.' : 'Sign in to see your lists.'}
        </Text>

        {isSignUp ? (
          <TextInput
            style={inputStyle}
            placeholder="Name (optional)"
            placeholderTextColor={theme.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
        ) : null}
        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <PasswordInput
          placeholder="Password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          onSubmitEditing={() => canSubmit && !busy && submit()}
        />

        <ErrorText message={error} />
        {!isSignUp ? (
          <Link href="/forgot-password" style={[styles.forgot, { color: theme.primary }]}>
            Forgot password?
          </Link>
        ) : null}

        <Button
          title={isSignUp ? 'Sign up' : 'Sign in'}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          style={{ marginTop: 16 }}
        />

        <Link href="/confirm" style={[styles.link, { color: theme.primary }]}>
          I already have an email code
        </Link>
        <Link href={isSignUp ? '/sign-in' : '/sign-up'} replace style={[styles.link, { color: theme.primary }]}>
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  wordmark: { fontSize: 40, fontFamily: listyFont.wordmark, marginBottom: 10, paddingBottom: 4 },
  title: { fontSize: 22, fontFamily: listyFont.semibold },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  link: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  forgot: { marginTop: 4, marginBottom: 4, fontSize: 15, fontWeight: '600' },
});
