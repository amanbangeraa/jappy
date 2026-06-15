import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { Card, ReviewRecord } from '../types';

export function useCards(lessonId: number | 'all') {
  const [cards, setCards] = useState<(Card & { review?: ReviewRecord })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      let allCards: Card[];
      if (lessonId === 'all') {
        allCards = await db.cards.toArray();
      } else {
        allCards = await db.cards.where('lessonId').equals(lessonId).toArray();
      }

      const cardIds = allCards.map((c) => c.id!);
      const reviews =
        cardIds.length > 0
          ? await db.reviewRecords.where('cardId').anyOf(cardIds).toArray()
          : [];
      const reviewMap = new Map(reviews.map((r) => [r.cardId, r]));

      const enriched = allCards.map((card) => ({
        ...card,
        review: reviewMap.get(card.id!),
      }));

      setCards(enriched);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  return { cards, loading, reload: loadCards };
}