export type JLPTLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type LessonLevel = JLPTLevel | 'Kanji';
export type UserRole = 'student' | 'admin';

export interface Lesson {
  id?: number;
  name: string;
  level: LessonLevel;
  importedAt: number;
}

export interface Card {
  id?: number;
  lessonId: number;
  japanese: string;
  english: string;
  reading?: string;
}

export interface ReviewRecord {
  id?: number;
  cardId: number;
  userId?: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  dueDate: number;
}

export interface SessionLog {
  id?: number;
  cardId: number;
  userId: number;
  grade: Grade;
  reviewedAt: number;
}

export type Grade = 0 | 1 | 2 | 3;

export interface CSVRow {
  japanese: string;
  english: string;
  reading?: string;
}

export interface SessionResult {
  cardId: number;
  japanese: string;
  english: string;
  reading?: string;
  grade: Grade;
}

export interface LessonStats {
  totalCards: number;
  dueCards: number;
  lastStudied: number | null;
}

export interface SummaryData {
  totalReviewed: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  xpEarned: number;
  accuracy: number;
  results: SessionResult[];
}

// ── Auth ──

export interface User {
  id?: number;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  createdAt?: number;
}

export interface Session {
  id?: number;
  userId: number;
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  adminSecret?: string;
}

export const LEVEL_ORDER: LessonLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'Kanji'];

export const LEVEL_COLORS: Record<LessonLevel, string> = {
  N5: '#58CC02',
  N4: '#1CB0F6',
  N3: '#FF9600',
  N2: '#CE82FF',
  N1: '#FF4B4B',
  Kanji: '#7C5CFF',
};

export const LEVEL_LABELS: Record<LessonLevel, string> = {
  N5: 'N5 — Beginner',
  N4: 'N4 — Basic',
  N3: 'N3 — Intermediate',
  N2: 'N2 — Pre-Advanced',
  N1: 'N1 — Advanced',
  Kanji: 'Kanji — Characters',
};