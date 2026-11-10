import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import type { Item } from './use-items';

function asRow(value: unknown): Partial<Item> {
  if (!value || typeof value !== 'object') return {};
  return value as Partial<Item>;
}

/**
 * Subscribes to Postgres changes for the signed-in user and invalidates the
 * matching queries, so edits made by other members show up live. Row Level
 * Security limits which change events a user receives.
 *
 * INSERT payloads include the full row. UPDATE/DELETE often only include the
 * primary key unless replica identity is FULL, so we always refetch every
 * items query rather than depending on list_id being present.
 */
export function useRealtimeSync(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`sync:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        const next = asRow(payload.new);
        const prev = asRow(payload.old);
        const id = next.id ?? prev.id;

        if (payload.eventType === 'DELETE' && id) {
          qc.setQueriesData<Item[]>({ queryKey: ['items'] }, (items) => items?.filter((item) => item.id !== id));
        } else if (payload.eventType === 'UPDATE' && id) {
          qc.setQueriesData<Item[]>({ queryKey: ['items'] }, (items) =>
            items?.map((item) => (item.id === id ? { ...item, ...next } : item)),
          );
        }

        qc.invalidateQueries({ queryKey: ['items'] });
        qc.invalidateQueries({ queryKey: ['lists'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members' }, (payload) => {
        const next = asRow(payload.new);
        const prev = asRow(payload.old);
        const listId = next.list_id ?? prev.list_id;
        if (listId) {
          qc.invalidateQueries({ queryKey: ['members', listId] });
          qc.invalidateQueries({ queryKey: ['list', listId] });
        }
        qc.invalidateQueries({ queryKey: ['members'] });
        qc.invalidateQueries({ queryKey: ['lists'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, (payload) => {
        const next = asRow(payload.new);
        const prev = asRow(payload.old);
        const id = next.id ?? prev.id;
        if (id) qc.invalidateQueries({ queryKey: ['list', id] });
        qc.invalidateQueries({ queryKey: ['lists'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
