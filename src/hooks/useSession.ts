import { useState, useCallback, useRef } from 'react';
import { fetchDueCards, submitGrade, type DueCard } from '../api/client';
import { updateReview, QUALITY_MAP } from '../algorithms/sm2';
import type { Grade, ReviewRecord, SessionResult, SummaryData } from '../types';

export function useSession(lessonId: number | 'all') {
  // Use a ref as the source-of-truth for the queue to avoid stale closures.
  const queueRef      = useRef<DueCard[]>([]);
  const indexRef      = useRef(0);
  const resultsRef    = useRef<SessionResult[]>([]);
  // Track which card IDs have already been re-queued this session (1 re-queue max per card)
  const requeuedRef   = useRef<Set<number>>(new Set());

  const [, forceUpdate]  = useState(0);          // dummy state just to re-render
  const [loading, setLoading]    = useState(true);
  const [finished, setFinished]  = useState(false);
  const [summary, setSummary]    = useState<SummaryData | null>(null);
  const [error, setError]        = useState<string | null>(null);

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
      if (lessonId === 'all') {
        // For 'all', fetch all lessons first, then due cards for each
        const { fetchLessons } = await import('../api/client');
        const allLessons = await fetchLessons();
        const dueCards: DueCard[] = [];
        for (const lesson of allLessons) {
          const cards = await fetchDueCards(lesson.id!);
          for (const card of cards) {
            dueCards.push(card);
          }
        }
        queueRef.current = shuffle(dueCards);
      } else {
        const cards = await fetchDueCards(lessonId);
        queueRef.current = shuffle(cards);
      }
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

    // Record result optimistically
    resultsRef.current.push({
      cardId:   card.id!,
      japanese: card.japanese,
      english:  card.english,
      reading:  card.reading,
      grade,
    });

    // Compute updated SM2 state
    const existing: ReviewRecord = {
      cardId: card.id!,
      interval: card.interval ?? 1,
      easeFactor: card.easeFactor ?? 2.0,
      repetitions: card.repetitions ?? 0,
      dueDate: card.dueDate ?? 0,
    };

    const updated = updateReview(existing, grade);

    // Persist to API — await so we don't advance before DB confirms
    try {
      await submitGrade({
        cardId: card.id!,
        grade,
        interval: updated.interval,
        easeFactor: updated.easeFactor,
        repetitions: updated.repetitions,
        dueDate: updated.dueDate,
      });
    } catch (err) {
      // Revert optimistic result on failure
      resultsRef.current = resultsRef.current.filter(
        (r) => !(r.cardId === card.id! && r.grade === grade)
      );
      setError(err instanceof Error ? err.message : 'Failed to save grade');
      rerender();
      return; // Don't advance — let the user retry
    }

    // Re-queue if missed and not already re-queued this session.
    // Use the UPDATED SM2 values so the re-queued card has correct
    // interval/repetitions/easeFactor for the next attempt.
    if (grade < 2 && !requeuedRef.current.has(card.id!)) {
      requeuedRef.current.add(card.id!);
      queueRef.current = [...queue, {
        ...card,
        interval: updated.interval,
        easeFactor: updated.easeFactor,
        repetitions: updated.repetitions,
        dueDate: updated.dueDate,
      }];
    }

    // Advance to the next card
    const nextIndex = index + 1;
    if (nextIndex >= queueRef.current.length) {
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

  // Progress: track actual queue position (including re-queued cards from misses)
  const progress = {
    current: indexRef.current + 1,
    total: queue.length,
  };

  return {
    currentCard,
    loading,
    finished,
    summary,
    progress,
    error,
    startSession,
    gradeCard,
  };
}