import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { Lesson, LessonStats } from '../types';

export function useLessons() {
  const [lessons, setLessons] = useState<(Lesson & { stats: LessonStats })[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    try {
      const allLessons = await db.lessons.orderBy('importedAt').reverse().toArray();
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const endOfToday = now.getTime();

      const enriched = await Promise.all(
        allLessons.map(async (lesson) => {
          const lessonCards = await db.cards.where('lessonId').equals(lesson.id!).toArray();
          const cardIds = lessonCards.map((c) => c.id!);

          let dueCards = 0;
          if (cardIds.length > 0) {
            // Cards without review records are due
            const reviewedIds = new Set(
              (await db.reviewRecords.where('cardId').anyOf(cardIds).toArray()).map((r) => r.cardId)
            );
            const unreviewedCards = cardIds.filter((id) => !reviewedIds.has(id));
            const dueRecords = await db.reviewRecords
              .where('cardId')
              .anyOf(cardIds)
              .filter((r) => r.dueDate <= endOfToday)
              .toArray();
            const dueRecordIds = new Set(dueRecords.map((r) => r.cardId));
            dueCards = unreviewedCards.length + dueRecordIds.size;
          }

          const lastStudiedLog = await db.sessionLogs
            .orderBy('reviewedAt')
            .reverse()
            .toArray()
            .then((logs) =>
              logs.filter((l) => cardIds.includes(l.cardId))
            );
          const lastStudied =
            lastStudiedLog.length > 0
              ? lastStudiedLog[0].reviewedAt
              : null;

          return {
            ...lesson,
            stats: {
              totalCards: lessonCards.length,
              dueCards,
              lastStudied,
            } as LessonStats,
          };
        })
      );
      setLessons(enriched);
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  return { lessons, loading, reload: loadLessons };
}