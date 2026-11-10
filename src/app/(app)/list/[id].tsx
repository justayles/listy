import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Centered, EmptyState, ErrorState, errorMessage } from '@/components/ui';
import {
  useAddItem,
  useClearCompleted,
  useDeleteItem,
  useItems,
  useRenameItem,
  useToggleItem,
  type Item,
} from '@/hooks/use-items';
import { useList } from '@/hooks/use-lists';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function ListDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { session } = useAuth();

  const list = useList(id);
  const items = useItems(id);
  const addItem = useAddItem(id, session?.user.id);
  const toggleItem = useToggleItem(id);
  const deleteItem = useDeleteItem(id);
  const renameItem = useRenameItem(id);
  const clearCompleted = useClearCompleted(id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const all = items.data ?? [];
    const open = all.filter((i) => !i.is_done);
    const done = all.filter((i) => i.is_done);
    return [
      { key: 'open', title: 'To do', data: open },
      ...(done.length > 0 ? [{ key: 'done', title: `Completed (${done.length})`, data: done }] : []),
    ];
  }, [items.data]);

  function onError(title: string) {
    return { onError: (e: unknown) => Alert.alert(title, errorMessage(e)) };
  }

  function submit() {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    setEditingId(null);
    addItem.mutate(title, {
      onError: (e) => {
        setDraft(title);
        Alert.alert('Could not add item', errorMessage(e));
      },
    });
  }

  function commitEdit(item: Item, nextTitle: string) {
    setEditingId(null);
    const title = nextTitle.trim();
    if (!title || title === item.title) return;
    renameItem.mutate({ id: item.id, title }, onError('Could not update item'));
  }

  function confirmClear() {
    Alert.alert('Clear completed items?', 'They will be removed for everyone on this list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearCompleted.mutate(undefined, onError('Could not clear items')) },
    ]);
  }

  async function refresh() {
    setRefreshing(true);
    await Promise.all([items.refetch(), list.refetch()]);
    setRefreshing(false);
  }

  // The list was deleted, or you were removed from it.
  if (list.isSuccess && list.data === null) {
    return (
      <Centered>
        <Stack.Screen options={{ title: 'List' }} />
        <EmptyState title="This list is no longer available" hint="It may have been deleted or unshared." />
        <Button title="Back to my lists" onPress={() => router.replace('/lists')} style={{ marginTop: 8 }} />
      </Centered>
    );
  }

  if (list.isPending || items.isPending) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={theme.primary} />
      </Centered>
    );
  }

  if (list.isError || items.isError) {
    return (
      <ErrorState
        message={errorMessage(list.error ?? items.error)}
        onRetry={() => {
          list.refetch();
          items.refetch();
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: list.data?.name ?? '',
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/share/[id]', params: { id } })}
              hitSlop={12}
              accessibilityLabel="Share list">
              <Ionicons name="person-add-outline" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add an item"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
          returnKeyType="done"
          blurOnSubmit={false}
          onFocus={() => setEditingId(null)}
          onSubmitEditing={submit}
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim()}
          accessibilityLabel="Add item"
          style={[styles.addBtn, { backgroundColor: theme.primary, opacity: draft.trim() ? 1 : 0.4 }]}>
          <Ionicons name="add" size={24} color={theme.primaryText} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={<EmptyState title="Nothing here yet" hint="Add your first item above." />}
        renderSectionHeader={({ section }) =>
          section.key === 'done' ? (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{section.title}</Text>
              <Pressable onPress={confirmClear} hitSlop={8}>
                <Text style={{ color: theme.danger, fontWeight: '600' }}>Clear completed</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            editing={editingId === item.id}
            onToggle={() =>
              toggleItem.mutate({ id: item.id, is_done: !item.is_done }, onError('Could not update item'))
            }
            onStartEdit={() => setEditingId(item.id)}
            onCommitEdit={(title) => commitEdit(item, title)}
            onDelete={() => {
              setEditingId((current) => (current === item.id ? null : current));
              deleteItem.mutate(item.id, onError('Could not delete item'));
            }}
          />
        )}
      />
    </View>
  );
}

function ItemRow({
  item,
  editing,
  onToggle,
  onStartEdit,
  onCommitEdit,
  onDelete,
}: {
  item: Item;
  editing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCommitEdit: (title: string) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={onToggle}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_done }}
        accessibilityLabel={item.is_done ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`}>
        <Ionicons
          name={item.is_done ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={item.is_done ? theme.success : theme.textMuted}
        />
      </Pressable>
      {editing ? (
        <InlineTitle title={item.title} onCommit={onCommitEdit} />
      ) : (
        <Pressable onPress={onStartEdit} onLongPress={onStartEdit} style={styles.rowMain}>
          <Text
            style={[
              styles.itemTitle,
              { color: item.is_done ? theme.textMuted : theme.text },
              item.is_done && { textDecorationLine: 'line-through' },
            ]}>
            {item.title}
          </Text>
        </Pressable>
      )}
      {!editing ? (
        <Pressable onPress={onStartEdit} hitSlop={10} accessibilityLabel={`Edit ${item.title}`}>
          <Ionicons name="create-outline" size={20} color={theme.textMuted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel={`Delete ${item.title}`}>
        <Ionicons name="trash-outline" size={20} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

function InlineTitle({ title, onCommit }: { title: string; onCommit: (next: string) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(title);
  const committed = useRef(false);

  function finish() {
    if (committed.current) return;
    committed.current = true;
    onCommit(text);
  }

  return (
    <TextInput
      autoFocus
      value={text}
      onChangeText={setText}
      onBlur={finish}
      onSubmitEditing={finish}
      returnKeyType="done"
      selectTextOnFocus
      style={[styles.itemInput, { color: theme.text }]}
      accessibilityLabel={`Edit ${title}`}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24, gap: 8, flexGrow: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
    minHeight: 52,
  },
  check: { paddingVertical: 4 },
  rowMain: { flex: 1, justifyContent: 'center', minHeight: 36 },
  itemTitle: { fontSize: 16 },
  itemInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
