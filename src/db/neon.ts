import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(DATABASE_URL);

/**
 * Run the initial migration to create all tables if they don't exist.
 * Safe to call on every cold start — uses IF NOT EXISTS.
 */
export async function runMigrations(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS lessons (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      imported_at BIGINT NOT NULL DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id          SERIAL PRIMARY KEY,
      lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      japanese    TEXT NOT NULL,
      english     TEXT NOT NULL,
      reading     TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS review_records (
      id            SERIAL PRIMARY KEY,
      card_id       INTEGER NOT NULL UNIQUE REFERENCES cards(id) ON DELETE CASCADE,
      interval      REAL NOT NULL DEFAULT 0,
      ease_factor   REAL NOT NULL DEFAULT 2.5,
      repetitions   INTEGER NOT NULL DEFAULT 0,
      due_date      BIGINT NOT NULL DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS session_logs (
      id          SERIAL PRIMARY KEY,
      card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      grade       SMALLINT NOT NULL,
      reviewed_at BIGINT NOT NULL
    );
  `;

  // Indexes for common query patterns
  await sql`CREATE INDEX IF NOT EXISTS idx_cards_lesson_id ON cards(lesson_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_review_records_due_date ON review_records(due_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_session_logs_card_id ON session_logs(card_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_session_logs_reviewed_at ON session_logs(reviewed_at)`;
}