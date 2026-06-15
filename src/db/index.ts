import Dexie, { type Table } from 'dexie';
import type { Card, Lesson, ReviewRecord, SessionLog } from '../types';

export class JappyDB extends Dexie {
  lessons!: Table<Lesson, number>;
  cards!: Table<Card, number>;
  reviewRecords!: Table<ReviewRecord, number>;
  sessionLogs!: Table<SessionLog, number>;

  constructor() {
    super('jappy');
    // v1 — original schema
    this.version(1).stores({
      lessons: '++id, name',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, cardId, dueDate',
      sessionLogs: '++id, cardId, reviewedAt',
    });
    // v2 — add importedAt index so orderBy('importedAt') works
    this.version(2).stores({
      lessons: '++id, name, importedAt',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, cardId, dueDate',
      sessionLogs: '++id, cardId, reviewedAt',
    });
    // v3 — add level index for JLPT N1-N5 filtering
    this.version(3).stores({
      lessons: '++id, name, level, importedAt',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, cardId, dueDate',
      sessionLogs: '++id, cardId, reviewedAt',
    });
  }
}

export const db = new JappyDB();