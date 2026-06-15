export type JLPTLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

export interface Lesson {
  id?: number;
  name: string;
  level: JLPTLevel;
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
  interval: number;
  easeFactor: number;
  repetitions: number;
  dueDate: number;
}

export interface SessionLog {
  id?: number;
  cardId: number;
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

export const LEVEL_ORDER: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export const LEVEL_COLORS: Record<JLPTLevel, string> = {
  N5: '#58CC02',
  N4: '#1CB0F6',
  N3: '#FF9600',
  N2: '#CE82FF',
  N1: '#FF4B4B',
};

export const LEVEL_LABELS: Record<JLPTLevel, string> = {
  N5: 'N5 — Beginner',
  N4: 'N4 — Basic',
  N3: 'N3 — Intermediate',
  N2: 'N2 — Pre-Advanced',
  N1: 'N1 — Advanced',
};