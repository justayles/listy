import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/lib/theme';

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const bg =
    variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : 'transparent';
  const fg = variant === 'secondary' ? theme.primary : theme.primaryText;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: theme.primary },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return <Text style={[styles.error, { color: theme.danger }]}>{message}</Text>;
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: theme.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Message + retry shown when a query fails. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Centered>
      <ErrorText message={message} />
      <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: 12 }} />
    </Centered>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Something went wrong';
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 14, marginTop: 6, textAlign: 'center' },
});
