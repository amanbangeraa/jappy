import { useState, useEffect, useCallback } from 'react';
import { fetchLessons, importLesson, deleteLesson, type LessonWithStats } from '../api/client';

export function useLessons() {
  const [lessons, setLessons] = useState<LessonWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLessons();
      setLessons(data);
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const importCSV = useCallback(async (name: string, cards: { japanese: string; english: string; reading?: string }[]) => {
    const lesson = await importLesson(name, cards);
    await loadLessons();
    return lesson;
  }, [loadLessons]);

  const removeLesson = useCallback(async (id: number) => {
    await deleteLesson(id);
    await loadLessons();
  }, [loadLessons]);

  return { lessons, loading, reload: loadLessons, importCSV, removeLesson };
}