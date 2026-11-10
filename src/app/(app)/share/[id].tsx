import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Centered, ErrorState, ErrorText, errorMessage } from '@/components/ui';
import { useLeaveList, useList } from '@/hooks/use-lists';
import { useMembers, useRemoveMember, useShareList, type Member } from '@/hooks/use-members';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function ShareList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;

  const list = useList(id);
  const members = useMembers(id);
  const share = useShareList(id);
  const removeMember = useRemoveMember(id);
  const leaveList = useLeaveList();

  const [email, setEmail] = useState('');
  const isOwner = list.data?.owner_id === userId;

  function submit() {
    const value = email.trim();
    if (!value) return;
    share.mutate(value, { onSuccess: () => setEmail('') });
  }

  function confirmRemove(member: Member) {
    Alert.alert(`Remove ${member.display_name ?? member.email}?`, 'They will no longer see this list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeMember.mutate(member.user_id, {
            onError: (e) => Alert.alert('Could not remove member', errorMessage(e)),
          }),
      },
    ]);
  }

  function confirmLeave() {
    Alert.alert('Leave this list?', 'It will disappear from your lists.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          leaveList.mutate(
            { listId: id, userId: userId! },
            {
              onSuccess: () => router.dismissTo('/lists'),
              onError: (e) => Alert.alert('Could not leave list', errorMessage(e)),
            },
          ),
      },
    ]);
  }

  if (list.isPending || members.isPending) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={theme.primary} />
      </Centered>
    );
  }

  if (list.isError || members.isError) {
    return (
      <ErrorState
        message={errorMessage(list.error ?? members.error)}
        onRetry={() => {
          list.refetch();
          members.refetch();
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior="padding">
      <FlatList
        data={members.data}
        keyExtractor={(m) => m.user_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.listName, { color: theme.text }]}>{list.data?.name}</Text>
            {isOwner ? (
              <>
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Add someone by email. They need to have signed up for the app first, and can then add, check off and
                  delete items.
                </Text>
                <View style={styles.inviteRow}>
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (share.isError) share.reset();
                    }}
                    placeholder="friend@example.com"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onSubmitEditing={submit}
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                  />
                  <Button
                    title="Share"
                    onPress={submit}
                    loading={share.isPending}
                    disabled={!email.trim()}
                    style={{ paddingHorizontal: 20 }}
                  />
                </View>
                <ErrorText message={share.isError ? errorMessage(share.error) : null} />
              </>
            ) : (
              <Text style={[styles.hint, { color: theme.textMuted }]}>Only the owner can add or remove people.</Text>
            )}
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>People with access</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelf = item.user_id === userId;
          return (
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="person-circle-outline" size={32} color={theme.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                  {item.display_name ?? item.email}
                  {isSelf ? ' (you)' : ''}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 13 }} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.badge }]}>
                <Text style={{ color: theme.badgeText, fontSize: 12, fontWeight: '500' }}>
                  {item.role === 'owner' ? 'Owner' : 'Editor'}
                </Text>
              </View>
              {isOwner && item.role !== 'owner' ? (
                <Pressable onPress={() => confirmRemove(item)} hitSlop={10} accessibilityLabel={`Remove ${item.email}`}>
                  <Ionicons name="close-circle-outline" size={22} color={theme.danger} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          !isOwner ? (
            <Button title="Leave list" variant="danger" onPress={confirmLeave} style={{ marginTop: 24 }} />
          ) : undefined
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  listName: { fontSize: 22, fontWeight: '700' },
  hint: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  inviteRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberName: { fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
