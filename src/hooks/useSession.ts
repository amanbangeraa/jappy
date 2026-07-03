import { useState, useCallback, useRef } from 'react';
import { fetchDueCards, fetchLessons, fetchCards, submitGrade, type DueCard, type CardWithReview } from '../api/client';
import { updateReview, QUALITY_MAP } from '../algorithms/sm2';
import type { Grade, ReviewRecord, SessionResult, SummaryData } from '../types';

function toDueCard(card: CardWithReview): DueCard {
  return {
    ...card,
    dueDate: card.review?.dueDate ?? 0,
    interval: card.review?.interval ?? 1,
    easeFactor: card.review?.easeFactor ?? 2.0,
    repetitions: card.review?.repetitions ?? 0,
  };
}

export function useSession(lessonId: number | 'all', reviewAll = false) {
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const queueRef = useRef<DueCard[]>([]);
  const indexRef = useRef(0);
  const gradingRef = useRef(false);
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

  const setSessionQueue = useCallback((nextQueue: DueCard[]) => {
    queueRef.current = nextQueue;
    setQueue(nextQueue);
  }, []);

  const setSessionIndex = useCallback((nextIndex: number) => {
    indexRef.current = nextIndex;
    setIndex(nextIndex);
  }, []);

  const startSession = useCallback(async () => {
    setLoading(true);
    setFinished(false);
    setSessionQueue([]);
    setSessionIndex(0);
    gradingRef.current = false;
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
          const cards = reviewAll
            ? (await fetchCards(lesson.id!)).map(toDueCard)
            : await fetchDueCards(lesson.id!);
          for (const card of cards) {
            dueCards.push(card);
          }
        }
        setSessionQueue(shuffle(dueCards));
      } else {
        const cards = reviewAll
          ? (await fetchCards(lessonId)).map(toDueCard)
          : await fetchDueCards(lessonId);
        setSessionQueue(shuffle(cards));
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }, [lessonId, reviewAll, setSessionIndex, setSessionQueue]);

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

  const gradeCard = useCallback(async (gradeKey: string) => {
    if (gradingRef.current) return;

    const currentQueue = queueRef.current;
    const currentIndex = indexRef.current;
    const card = currentQueue[currentIndex];
    if (!card) return;

    gradingRef.current = true;
    const grade: Grade = QUALITY_MAP[gradeKey] ?? 0;

    // Compute updated SM2 state before saving so the server and UI stay in sync.
    const existing: ReviewRecord = {
      cardId: card.id!,
      interval: card.interval ?? 1,
      easeFactor: card.easeFactor ?? 2.0,
      repetitions: card.repetitions ?? 0,
      dueDate: card.dueDate ?? 0,
    };

    const updated = updateReview(existing, grade);

    setError(null);

    resultsRef.current.push({
      cardId: card.id!,
      japanese: card.japanese,
      english: card.english,
      reading: card.reading,
      grade,
    });

    let nextQueue = currentQueue;

    // Re-queue if missed and not already re-queued this session.
    if (grade < 2 && !requeuedRef.current.has(card.id!)) {
      requeuedRef.current.add(card.id!);
      nextQueue = [...currentQueue, {
        ...card,
        interval: updated.interval,
        easeFactor: updated.easeFactor,
        repetitions: updated.repetitions,
        dueDate: updated.dueDate,
      }];
      setSessionQueue(nextQueue);
    }

    const nextIndex = currentIndex + 1;
    setSessionIndex(nextIndex);
    if (nextIndex >= nextQueue.length) {
      setFinished(true);
      buildSummary();
    }

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
      setError(err instanceof Error ? err.message : 'Failed to save grade');
    } finally {
      gradingRef.current = false;
    }
  }, [buildSummary, setSessionIndex, setSessionQueue]);

  const currentCard = queue[index] ?? null;

  // Progress tracks actual queue position, including re-queued cards from misses.
  const progress = {
    current: Math.min(index + 1, queue.length),
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
