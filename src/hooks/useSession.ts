import { useState, useCallback, useRef } from 'react';
import { db } from '../db';
import { updateReview, freshRecord, QUALITY_MAP } from '../algorithms/sm2';
import type { Card, Grade, SessionResult, SummaryData } from '../types';

type QueueCard = Card & { dueDate?: number };

export function useSession(lessonId: number | 'all') {
  // Use a ref as the source-of-truth for the queue to avoid stale closures.
  // React state is only used to trigger re-renders.
  const queueRef      = useRef<QueueCard[]>([]);
  const indexRef      = useRef(0);
  const resultsRef    = useRef<SessionResult[]>([]);
  // Track which card IDs have already been re-queued this session (1 re-queue max per card)
  const requeuedRef   = useRef<Set<number>>(new Set());

  const [, forceUpdate]  = useState(0);          // dummy state just to re-render
  const [loading, setLoading]    = useState(true);
  const [finished, setFinished]  = useState(false);
  const [summary, setSummary]    = useState<SummaryData | null>(null);

  const rerender = () => forceUpdate((n) => n + 1);

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const startSession = useCallback(async () => {
    setLoading(true);
    setFinished(false);
    queueRef.current    = [];
    indexRef.current    = 0;
    resultsRef.current  = [];
    requeuedRef.current = new Set();
    setSummary(null);

    try {
      let allCards: Card[];
      if (lessonId === 'all') {
        allCards = await db.cards.toArray();
      } else {
        allCards = await db.cards.where('lessonId').equals(lessonId).toArray();
      }

      const cardIds = allCards.map((c) => c.id!);
      const reviews = cardIds.length > 0
        ? await db.reviewRecords.where('cardId').anyOf(cardIds).toArray()
        : [];
      const reviewMap = new Map(reviews.map((r) => [r.cardId, r]));

      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const endOfToday = now.getTime();

      const dueCards = allCards
        .map((card) => {
          const review = reviewMap.get(card.id!);
          if (!review) return { ...card, dueDate: 0 };
          return { ...card, dueDate: review.dueDate };
        })
        .filter((card) => card.dueDate <= endOfToday);

      queueRef.current = shuffle(dueCards);
      rerender();
    } catch (err) {
      console.error('Failed to start session:', err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  const buildSummary = useCallback(() => {
    const results = resultsRef.current;
    // Only count the LAST grade for each card (re-queued cards appear multiple times)
    const lastGradePerCard = new Map<number, Grade>();
    for (const r of results) lastGradePerCard.set(r.cardId, r.grade);

    const gotItCount  = [...lastGradePerCard.values()].filter((g) => g >= 2).length;
    const missedCount = [...lastGradePerCard.values()].filter((g) => g <  2).length;
    const total       = lastGradePerCard.size;
    const accuracy    = total > 0 ? Math.round((gotItCount / total) * 100) : 0;
    const xpEarned    = gotItCount * 10;

    setSummary({
      totalReviewed: total,
      againCount:    missedCount,
      hardCount:     0,
      goodCount:     gotItCount,
      easyCount:     0,
      xpEarned,
      accuracy,
      results,
    });
  }, []);

  const gradeCard = useCallback(async (gradeKey: string) => {
    const queue = queueRef.current;
    const index = indexRef.current;
    if (index >= queue.length) return;

    const card  = queue[index];
    const grade: Grade = QUALITY_MAP[gradeKey] ?? 0;

    // Record result
    resultsRef.current.push({
      cardId:   card.id!,
      japanese: card.japanese,
      english:  card.english,
      reading:  card.reading,
      grade,
    });

    // Persist to DB
    const existing = await db.reviewRecords.where('cardId').equals(card.id!).first();
    if (existing) {
      await db.reviewRecords.update(existing.id!, updateReview(existing, grade));
    } else {
      await db.reviewRecords.add(updateReview(freshRecord(card.id!), grade));
    }
    await db.sessionLogs.add({ cardId: card.id!, grade, reviewedAt: Date.now() });

    // ── Re-queue logic ──
    // If missed AND this card hasn't been re-queued yet this session → push to end
    if (grade < 2 && !requeuedRef.current.has(card.id!)) {
      requeuedRef.current.add(card.id!);
      queueRef.current = [...queue, { ...card }]; // append a fresh copy
    }

    // Advance
    const nextIndex = index + 1;
    if (nextIndex >= queueRef.current.length) {
      // All cards exhausted (including any re-queued ones)
      indexRef.current = nextIndex;
      setFinished(true);
      buildSummary();
    } else {
      indexRef.current = nextIndex;
      rerender();
    }
  }, [buildSummary]);

  const queue       = queueRef.current;
  const currentCard = queue[indexRef.current] ?? null;

  // Progress: show position among unique cards, not counting re-queued duplicates
  const uniqueTotal   = new Set(queue.map((c) => c.id)).size;
  const uniqueDone    = new Set(resultsRef.current.map((r) => r.cardId)).size;
  const progress      = { current: Math.min(uniqueDone + 1, uniqueTotal), total: uniqueTotal };

  return {
    currentCard,
    loading,
    finished,
    summary,
    progress,
    startSession,
    gradeCard,
  };
}