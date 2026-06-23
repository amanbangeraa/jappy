import { useState, useCallback, useRef } from 'react';
import { fetchDueCards, fetchLessons, submitGrade, type DueCard } from '../api/client';
import { updateReview, QUALITY_MAP } from '../algorithms/sm2';
import type { Grade, ReviewRecord, SessionResult, SummaryData } from '../types';

export function useSession(lessonId: number | 'all') {
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const resultsRef = useRef<SessionResult[]>([]);
  // Track which card IDs have already been re-queued this session (1 re-queue max per card)
  const requeuedRef = useRef<Set<number>>(new Set());

  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setQueue([]);
    setIndex(0);
    resultsRef.current = [];
    requeuedRef.current = new Set();
    setSummary(null);
    setError(null);

    try {
      if (lessonId === 'all') {
        // For 'all', fetch all lessons first, then due cards for each.
        const allLessons = await fetchLessons();
        const dueCards: DueCard[] = [];
        for (const lesson of allLessons) {
          const cards = await fetchDueCards(lesson.id!);
          for (const card of cards) {
            dueCards.push(card);
          }
        }
        setQueue(shuffle(dueCards));
      } else {
        const cards = await fetchDueCards(lessonId);
        setQueue(shuffle(cards));
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  const buildSummary = useCallback(() => {
    const results = resultsRef.current;
    // Only count the LAST grade for each card (re-queued cards appear multiple times).
    const lastGradePerCard = new Map<number, Grade>();
    for (const r of results) lastGradePerCard.set(r.cardId, r.grade);

    const gotItCount = [...lastGradePerCard.values()].filter((g) => g >= 2).length;
    const missedCount = [...lastGradePerCard.values()].filter((g) => g < 2).length;
    const total = lastGradePerCard.size;
    const accuracy = total > 0 ? Math.round((gotItCount / total) * 100) : 0;
    const xpEarned = gotItCount * 10;

    setSummary({
      totalReviewed: total,
      againCount: missedCount,
      hardCount: 0,
      goodCount: gotItCount,
      easyCount: 0,
      xpEarned,
      accuracy,
      results,
    });
  }, []);

  const gradeCard = useCallback((gradeKey: string) => {
    const card = queue[index];
    if (!card) return;

    const grade: Grade = QUALITY_MAP[gradeKey] ?? 0;

    // Record result optimistically.
    resultsRef.current.push({
      cardId: card.id!,
      japanese: card.japanese,
      english: card.english,
      reading: card.reading,
      grade,
    });

    // Compute updated SM2 state.
    const existing: ReviewRecord = {
      cardId: card.id!,
      interval: card.interval ?? 1,
      easeFactor: card.easeFactor ?? 2.0,
      repetitions: card.repetitions ?? 0,
      dueDate: card.dueDate ?? 0,
    };

    const updated = updateReview(existing, grade);

    // Fire-and-forget API call; don't block UI advancement.
    submitGrade({
      cardId: card.id!,
      grade,
      interval: updated.interval,
      easeFactor: updated.easeFactor,
      repetitions: updated.repetitions,
      dueDate: updated.dueDate,
    }).catch((err) => {
      // Revert optimistic result on failure.
      resultsRef.current = resultsRef.current.filter(
        (r) => !(r.cardId === card.id! && r.grade === grade)
      );
      setError(err instanceof Error ? err.message : 'Failed to save grade');
    });

    let nextQueue = queue;

    // Re-queue if missed and not already re-queued this session.
    // Use the UPDATED SM2 values so the re-queued card has correct schedule state.
    if (grade < 2 && !requeuedRef.current.has(card.id!)) {
      requeuedRef.current.add(card.id!);
      nextQueue = [...queue, {
        ...card,
        interval: updated.interval,
        easeFactor: updated.easeFactor,
        repetitions: updated.repetitions,
        dueDate: updated.dueDate,
      }];
      setQueue(nextQueue);
    }

    // Advance to the next card immediately.
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= nextQueue.length) {
      setFinished(true);
      buildSummary();
    }
  }, [buildSummary, index, queue]);

  const currentCard = queue[index] ?? null;

  // Progress tracks actual queue position, including re-queued cards from misses.
  const progress = {
    current: index + 1,
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
