import Dexie, { type Table } from 'dexie';
import type { Card, Lesson, ReviewRecord, SessionLog, User, Session } from '../types';

export class JappyDB extends Dexie {
  lessons!: Table<Lesson, number>;
  cards!: Table<Card, number>;
  reviewRecords!: Table<ReviewRecord, number>;
  sessionLogs!: Table<SessionLog, number>;
  users!: Table<User, number>;
  sessions!: Table<Session, number>;

  constructor() {
    super('jappy');
    this.version(1).stores({
      lessons: '++id, name',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, cardId, dueDate',
      sessionLogs: '++id, cardId, reviewedAt',
    });
    this.version(2).stores({
      lessons: '++id, name, importedAt',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, cardId, dueDate',
      sessionLogs: '++id, cardId, reviewedAt',
    });
    this.version(3).stores({
      lessons: '++id, name, level, importedAt',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, cardId, dueDate',
      sessionLogs: '++id, cardId, reviewedAt',
    });
    // v4 — add users, sessions, userId to review_records and session_logs
    this.version(4).stores({
      lessons: '++id, name, level, importedAt',
      cards: '++id, lessonId, japanese',
      reviewRecords: '++id, [cardId+userId], dueDate',
      sessionLogs: '++id, cardId, reviewedAt, userId',
      users: '++id, username, email, role',
      sessions: '++id, userId, token',
    });
  }
}

export const db = new JappyDB();