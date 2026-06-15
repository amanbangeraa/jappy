export interface Lesson {
  id?: number;
  name: string;
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