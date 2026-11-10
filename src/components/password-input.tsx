import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/lib/theme';

export function PasswordInput({
  style,
  ...props
}: Omit<TextInputProps, 'secureTextEntry'>) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TextInput
        {...props}
        style={[styles.input, { color: theme.text }, style]}
        placeholderTextColor={props.placeholderTextColor ?? theme.textMuted}
        secureTextEntry={!visible}
        autoCapitalize="none"
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, marginRight: 8 },
});
