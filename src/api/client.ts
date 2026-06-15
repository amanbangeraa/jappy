import type { Lesson, Card, ReviewRecord, LessonStats, JLPTLevel } from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Lessons ──

export interface LessonWithStats extends Lesson {
  stats: LessonStats;
}

export async function fetchLessons(level?: JLPTLevel): Promise<LessonWithStats[]> {
  const query = level ? `?level=${level}` : '';
  return request<LessonWithStats[]>(`/lessons${query}`);
}

export async function importLesson(
  name: string,
  level: JLPTLevel,
  cards: { japanese: string; english: string; reading?: string }[],
): Promise<LessonWithStats> {
  return request<LessonWithStats>('/lessons', {
    method: 'POST',
    body: JSON.stringify({ name, level, cards }),
  });
}

export async function deleteLesson(id: number): Promise<void> {
  await request(`/lessons?id=${id}`, { method: 'DELETE' });
}

// ── Cards ──

export interface CardWithReview extends Card {
  review: ReviewRecord | null;
}

export async function fetchCards(lessonId: number): Promise<CardWithReview[]> {
  return request<CardWithReview[]>(`/cards?lessonId=${lessonId}`);
}

// ── Review / Study ──

export interface DueCard extends Card {
  dueDate: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
}

export async function fetchDueCards(lessonId: number): Promise<DueCard[]> {
  return request<DueCard[]>(`/review?lessonId=${lessonId}`);
}

export async function submitGrade(params: {
  cardId: number;
  grade: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  dueDate: number;
}): Promise<void> {
  await request('/review', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}