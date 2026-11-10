import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Item = {
  id: string;
  list_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
};

export const itemKeys = {
  forList: (listId: string) => ['items', listId] as const,
};

export function useItems(listId: string) {
  return useQuery({
    queryKey: itemKeys.forList(listId),
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, list_id, title, is_done, position, created_by, created_at')
        .eq('list_id', listId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Shared plumbing for optimistic item mutations: apply `update` to the cached
 * list immediately, roll back on error, and refetch when settled.
 */
function useOptimisticItemMutation<TVars>(
  listId: string,
  mutationFn: (vars: TVars) => Promise<void>,
  update: (items: Item[], vars: TVars) => Item[],
) {
  const qc = useQueryClient();
  const key = itemKeys.forList(listId);

  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Item[]>(key);
      qc.setQueryData<Item[]>(key, (old) => update(old ?? [], vars));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useAddItem(listId: string, userId: string | undefined) {
  return useOptimisticItemMutation<string>(
    listId,
    async (title) => {
      const position = -Date.now();
      const { error } = await supabase.from('items').insert({
        list_id: listId,
        title: title.trim(),
        position,
      });
      if (error) throw error;
    },
    (items, title) => {
      const position = -Date.now();
      return [
        {
          id: `temp-${Date.now()}`,
          list_id: listId,
          title: title.trim(),
          is_done: false,
          position,
          created_by: userId ?? null,
          created_at: new Date().toISOString(),
        },
        ...items,
      ];
    },
  );
}

export function useToggleItem(listId: string) {
  return useOptimisticItemMutation<{ id: string; is_done: boolean }>(
    listId,
    async ({ id, is_done }) => {
      const { error } = await supabase.from('items').update({ is_done }).eq('id', id);
      if (error) throw error;
    },
    (items, { id, is_done }) => items.map((i) => (i.id === id ? { ...i, is_done } : i)),
  );
}

export function useRenameItem(listId: string) {
  return useOptimisticItemMutation<{ id: string; title: string }>(
    listId,
    async ({ id, title }) => {
      const { error } = await supabase.from('items').update({ title: title.trim() }).eq('id', id);
      if (error) throw error;
    },
    (items, { id, title }) => items.map((i) => (i.id === id ? { ...i, title: title.trim() } : i)),
  );
}

export function useDeleteItem(listId: string) {
  return useOptimisticItemMutation<string>(
    listId,
    async (id) => {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
    },
    (items, id) => items.filter((i) => i.id !== id),
  );
}

export function useClearCompleted(listId: string) {
  return useOptimisticItemMutation<void>(
    listId,
    async () => {
      const { error } = await supabase.from('items').delete().eq('list_id', listId).eq('is_done', true);
      if (error) throw error;
    },
    (items) => items.filter((i) => !i.is_done),
  );
}
