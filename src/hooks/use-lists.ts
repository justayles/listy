import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ListSummary = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  memberCount: number;
  openCount: number;
};

export const listKeys = {
  all: ['lists'] as const,
  detail: (id: string) => ['list', id] as const,
};

export function useLists() {
  return useQuery({
    queryKey: listKeys.all,
    queryFn: async (): Promise<ListSummary[]> => {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, owner_id, created_at, list_members(count), items(count)')
        .eq('items.is_done', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        owner_id: row.owner_id,
        created_at: row.created_at,
        memberCount: row.list_members[0]?.count ?? 0,
        openCount: row.items[0]?.count ?? 0,
      }));
    },
  });
}

export function useList(id: string) {
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, owner_id, created_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('lists')
        .insert({ name: name.trim() })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: listKeys.all }),
  });
}

export function useRenameList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('lists').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: listKeys.all });
      const previous = qc.getQueryData<ListSummary[]>(listKeys.all);
      qc.setQueryData<ListSummary[]>(listKeys.all, (old) =>
        old?.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKeys.all, ctx.previous);
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: listKeys.all });
      qc.invalidateQueries({ queryKey: listKeys.detail(id) });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lists').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKeys.all });
      const previous = qc.getQueryData<ListSummary[]>(listKeys.all);
      qc.setQueryData<ListSummary[]>(listKeys.all, (old) => old?.filter((l) => l.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: listKeys.all }),
  });
}

/** Leave a list that someone else owns (removes your own membership row). */
export function useLeaveList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      const { error } = await supabase
        .from('list_members')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: listKeys.all }),
  });
}
