import { useState, useEffect, useCallback } from 'react';
import { fetchCards, type CardWithReview } from '../api/client';

export function useCards(lessonId: number | 'all') {
  const [cards, setCards] = useState<CardWithReview[]>([]);
  const [loading, setLoading] = useState(() => lessonId !== 'all');

  const loadCards = useCallback(async () => {
    if (lessonId === 'all') {
      // For 'all', we still need to fetch — but the API doesn't support 'all' directly.
      // This is handled by useSession which fetches due cards across all lessons.
      // For the card listing page, we don't show 'all' — only individual lessons.
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCards(lessonId);
      setCards(data);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void Promise.resolve().then(loadCards);
  }, [loadCards]);

  return { cards, loading, reload: loadCards };
}