'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface WatchlistItem {
  id: string;
  item_type: string;
  item_value: string;
  company_id?: string | null;
}

interface WatchlistContextType {
  items: WatchlistItem[];
  isLoading: boolean;
  isWatching: (itemType: string, itemValue: string) => boolean;
  toggle: (itemType: string, itemValue: string, companyId?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType>({
  items: [],
  isLoading: false,
  isWatching: () => false,
  toggle: async () => {},
  refresh: async () => {},
});

export function useWatchlistContext() {
  return useContext(WatchlistContext);
}

interface WatchlistProviderProps {
  children: ReactNode;
  tier: 'free' | 'pro' | 'report';
}

export function WatchlistProvider({ children, tier }: WatchlistProviderProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.id) setUserId(parsed.id);
      } catch {
        // ignore
      }
    }
  }, []);

  const fetchItems = useCallback(async () => {
    if (!userId || tier !== 'pro') return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/watchlist?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [userId, tier]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const isWatching = useCallback(
    (itemType: string, itemValue: string) =>
      items.some((i) => i.item_type === itemType && i.item_value === itemValue),
    [items]
  );

  const toggle = useCallback(
    async (itemType: string, itemValue: string, companyId?: string) => {
      if (!userId || tier !== 'pro') return;

      const existing = items.find((i) => i.item_type === itemType && i.item_value === itemValue);

      if (existing) {
        // Optimistic remove
        setItems((prev) => prev.filter((i) => i.id !== existing.id));
        try {
          await fetch(`/api/watchlist?id=${existing.id}&user_id=${userId}`, { method: 'DELETE' });
        } catch {
          // Revert on failure
          setItems((prev) => [...prev, existing]);
        }
      } else {
        // Optimistic add with temp id
        const tempId = `temp-${Date.now()}`;
        const tempItem: WatchlistItem = { id: tempId, item_type: itemType, item_value: itemValue, company_id: companyId };
        setItems((prev) => [...prev, tempItem]);
        try {
          const res = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, item_type: itemType, item_value: itemValue, company_id: companyId }),
          });
          if (res.ok) {
            const data = await res.json();
            // Replace temp with real item
            setItems((prev) => prev.map((i) => (i.id === tempId ? { ...i, id: data.item?.id || tempId } : i)));
          } else {
            // Revert on failure
            setItems((prev) => prev.filter((i) => i.id !== tempId));
          }
        } catch {
          setItems((prev) => prev.filter((i) => i.id !== tempId));
        }
      }
    },
    [userId, tier, items]
  );

  return (
    <WatchlistContext.Provider value={{ items, isLoading, isWatching, toggle, refresh: fetchItems }}>
      {children}
    </WatchlistContext.Provider>
  );
}
