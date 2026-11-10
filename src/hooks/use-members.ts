import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Member = {
  user_id: string;
  role: 'owner' | 'editor';
  email: string;
  display_name: string | null;
};

export const memberKeys = {
  forList: (listId: string) => ['members', listId] as const,
};

export function useMembers(listId: string) {
  return useQuery({
    queryKey: memberKeys.forList(listId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('list_members')
        .select('user_id, role, created_at, profiles(email, display_name)')
        .eq('list_id', listId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        user_id: row.user_id,
        role: row.role as Member['role'],
        email: row.profiles?.email ?? 'Unknown',
        display_name: row.profiles?.display_name ?? null,
      }));
    },
  });
}

export function useShareList(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc('share_list', { p_list_id: listId, p_email: email });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: memberKeys.forList(listId) });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useRemoveMember(listId: string) {
  const qc = useQueryClient();
  const key = memberKeys.forList(listId);
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('list_members')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Member[]>(key);
      qc.setQueryData<Member[]>(key, (old) => old?.filter((m) => m.user_id !== userId));
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
