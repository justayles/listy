import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PromptModal } from '@/components/prompt-modal';
import { Centered, EmptyState, ErrorState, errorMessage } from '@/components/ui';
import {
  useCreateList,
  useDeleteList,
  useLeaveList,
  useLists,
  useRenameList,
  type ListSummary,
} from '@/hooks/use-lists';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function MyLists() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const userId = session?.user.id;

  const lists = useLists();
  const createList = useCreateList();
  const renameList = useRenameList();
  const deleteList = useDeleteList();
  const leaveList = useLeaveList();

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ListSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await lists.refetch();
    setRefreshing(false);
  }

  function openMenu(list: ListSummary) {
    const isOwner = list.owner_id === userId;
    if (isOwner) {
      Alert.alert(list.name, undefined, [
        { text: 'Rename', onPress: () => setRenaming(list) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              `Delete "${list.name}"?`,
              list.memberCount > 1
                ? 'This list and all its items will be removed for everyone it is shared with.'
                : 'This list and all its items will be removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    deleteList.mutate(list.id, {
                      onError: (e) => Alert.alert('Could not delete list', errorMessage(e)),
                    }),
                },
              ],
            ),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert(list.name, 'This list is shared with you.', [
        {
          text: 'Leave list',
          style: 'destructive',
          onPress: () =>
            leaveList.mutate(
              { listId: list.id, userId: userId! },
              { onError: (e) => Alert.alert('Could not leave list', errorMessage(e)) },
            ),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', session?.user.email ?? undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut().catch(() => {}) },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={confirmSignOut} hitSlop={12} accessibilityLabel="Sign out">
              <Ionicons name="log-out-outline" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      {lists.isPending ? (
        <Centered>
          <ActivityIndicator size="large" color={theme.primary} />
        </Centered>
      ) : lists.isError ? (
        <ErrorState message={errorMessage(lists.error)} onRetry={() => lists.refetch()} />
      ) : (
        <FlatList
          data={lists.data}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <EmptyState title="No lists yet" hint="Tap + to create your first list, like Groceries." />
          }
          renderItem={({ item }) => {
            const shared = item.memberCount > 1;
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/list/[id]', params: { id: item.id } })}
                onLongPress={() => openMenu(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                      {item.openCount === 0 ? 'Nothing to do' : `${item.openCount} to do`}
                    </Text>
                    {shared ? (
                      <View style={[styles.badge, { backgroundColor: theme.badge }]}>
                        <Ionicons name="people" size={12} color={theme.badgeText} />
                        <Text style={[styles.badgeText, { color: theme.badgeText }]}>
                          {item.owner_id === userId ? `Shared with ${item.memberCount - 1}` : 'Shared with you'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Pressable onPress={() => openMenu(item)} hitSlop={12} accessibilityLabel={`Options for ${item.name}`}>
                  <Ionicons name="ellipsis-vertical" size={20} color={theme.textMuted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        accessibilityLabel="New list"
        onPress={() => setCreating(true)}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: 24 + insets.bottom }]}>
        <Ionicons name="add" size={30} color={theme.primaryText} />
      </Pressable>

      <PromptModal
        visible={creating}
        title="New list"
        placeholder="e.g. Groceries"
        submitLabel="Create"
        busy={createList.isPending}
        error={createList.isError ? errorMessage(createList.error) : null}
        onCancel={() => {
          setCreating(false);
          createList.reset();
        }}
        onSubmit={(name) =>
          createList.mutate(name, {
            onSuccess: (created) => {
              setCreating(false);
              router.push({ pathname: '/list/[id]', params: { id: created.id } });
            },
          })
        }
      />

      <PromptModal
        visible={!!renaming}
        title="Rename list"
        initialValue={renaming?.name}
        busy={renameList.isPending}
        error={renameList.isError ? errorMessage(renameList.error) : null}
        onCancel={() => {
          setRenaming(null);
          renameList.reset();
        }}
        onSubmit={(name) =>
          renaming &&
          renameList.mutate({ id: renaming.id, name }, { onSuccess: () => setRenaming(null) })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  name: { fontSize: 17, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
