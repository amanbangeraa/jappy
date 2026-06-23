import type { Lesson, Card, ReviewRecord, LessonStats, JLPTLevel, AuthResponse, RegisterData } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('jappy_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Auth ──

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth?path=login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  return request<AuthResponse>('/auth?path=register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function adminLogin(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth?path=admin-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await request('/auth?path=logout', { method: 'POST' });
}

export async function getMe(): Promise<{ user: AuthResponse['user'] }> {
  return request<{ user: AuthResponse['user'] }>('/auth?path=me');
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