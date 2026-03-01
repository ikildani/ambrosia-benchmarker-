'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WatchlistItem {
  id: string;
  user_id: string;
  item_type: 'modality' | 'indication' | 'company' | 'therapeutic_area';
  item_value: string;
  company_id: string | null;
  notify_on_new_deal: boolean;
  notify_on_trial_update: boolean;
  created_at: string;
}

export interface WatchlistActivity {
  type: string;
  date: string;
  title: string;
  detail: string;
  match_type: string;
  match_value: string;
}

export function useWatchlist(userId: string | null) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [activity, setActivity] = useState<WatchlistActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!userId) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`/api/watchlist?user_id=${userId}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 403) {
        setError('pro_required');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems(data.items || []);
      setError(null);
    } catch {
      clearTimeout(timeoutId);
      setError('Failed to load watchlist');
    }
  }, [userId]);

  const fetchActivity = useCallback(async () => {
    if (!userId) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`/api/watchlist/activity?user_id=${userId}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return;
      const data = await res.json();
      setActivity(data.activity || []);
    } catch {
      clearTimeout(timeoutId);
    }
  }, [userId]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      await Promise.all([fetchItems(), fetchActivity()]);
      setIsLoading(false);
    }
    if (userId) load();
  }, [userId, fetchItems, fetchActivity]);

  const addItem = useCallback(async (
    itemType: string,
    itemValue: string,
    companyId?: string
  ) => {
    if (!userId) return false;
    try {
      const addController = new AbortController();
      setTimeout(() => addController.abort(), 15000);
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          item_type: itemType,
          item_value: itemValue,
          company_id: companyId,
        }),
        signal: addController.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add');
      }
      await fetchItems();
      return true;
    } catch (err: any) {
      console.error('Add to watchlist error:', err.message);
      return false;
    }
  }, [userId, fetchItems]);

  const removeItem = useCallback(async (id: string) => {
    if (!userId) return false;
    try {
      const delController = new AbortController();
      setTimeout(() => delController.abort(), 15000);
      const res = await fetch(`/api/watchlist?id=${id}&user_id=${userId}`, {
        method: 'DELETE',
        signal: delController.signal,
      });
      if (!res.ok) throw new Error('Failed to remove');
      setItems(prev => prev.filter(i => i.id !== id));
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  const isWatching = useCallback((itemType: string, itemValue: string) => {
    return items.some(i => i.item_type === itemType && i.item_value === itemValue);
  }, [items]);

  return { items, activity, isLoading, error, addItem, removeItem, isWatching };
}
