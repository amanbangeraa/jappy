// -- Connection setup ---------------------------------------------------------

import { neon } from '@neondatabase/serverless';

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Neither DATABASE_URL_UNPOOLED nor DATABASE_URL environment variable is set');
  }
  return connectionString;
}

// -- HTTP SQL client ----------------------------------------------------------

interface QueryResult<T = Record<string, unknown>> {
  fields: { name: string; dataTypeID: number }[];
  rows: T[];
  command: string;
  rowCount: number;
}

export async function executeQuery<T = Record<string, unknown>>(queryText: string, params: unknown[] = []): Promise<QueryResult<T>> {
  try {
    const sqlClient = neon(getConnectionString());
    const rows = await sqlClient.query(queryText, params) as T[];

    return {
      fields: [],
      rows,
      command: '',
      rowCount: rows.length,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Database query failed: ${error.message}`, { cause: error });
    }
    throw new Error('Unknown database query error', { cause: error });
  }
}

/**
 * Tagged template literal for SQL queries.
 * Usage: await sql`SELECT * FROM lessons WHERE id = ${id}`
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult['rows']> {
  let queryText = '';
  for (let i = 0; i < strings.length; i++) {
    queryText += strings[i];
    if (i < values.length) {
      queryText += `$${i + 1}`;
    }
  }
  return executeQuery(queryText, values).then((result) => result.rows);
}

// -- Migrations ---------------------------------------------------------------

export async function runMigrations(): Promise<void> {
  // -- Users & Sessions --
  await executeQuery(`CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('student', 'admin')),
    created_at    BIGINT NOT NULL DEFAULT 0
  )`);

  await executeQuery(`CREATE TABLE IF NOT EXISTS sessions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token         TEXT NOT NULL UNIQUE,
    created_at    BIGINT NOT NULL DEFAULT 0,
    expires_at    BIGINT NOT NULL
  )`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);

  // -- Lessons --
  await executeQuery(`CREATE TABLE IF NOT EXISTS lessons (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    level       TEXT NOT NULL DEFAULT 'N5',
    imported_at BIGINT NOT NULL DEFAULT 0
  )`);

  await executeQuery(`CREATE TABLE IF NOT EXISTS cards (
    id          SERIAL PRIMARY KEY,
    lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    japanese    TEXT NOT NULL,
    english     TEXT NOT NULL,
    reading     TEXT
  )`);

  await executeQuery(`CREATE TABLE IF NOT EXISTS review_records (
    id            SERIAL PRIMARY KEY,
    card_id       INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    interval      REAL NOT NULL DEFAULT 0,
    ease_factor   REAL NOT NULL DEFAULT 2.5,
    repetitions   INTEGER NOT NULL DEFAULT 0,
    due_date      BIGINT NOT NULL DEFAULT 0
  )`);

  await executeQuery(`CREATE TABLE IF NOT EXISTS session_logs (
    id          SERIAL PRIMARY KEY,
    card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    grade       SMALLINT NOT NULL,
    reviewed_at BIGINT NOT NULL
  )`);

  // -- Indexes --
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_cards_lesson_id ON cards(lesson_id)`);
  await executeQuery(`DELETE FROM review_records a
    USING review_records b
    WHERE a.id < b.id
      AND a.card_id = b.card_id
      AND a.user_id IS NOT DISTINCT FROM b.user_id`);
  await executeQuery(`DROP INDEX IF EXISTS idx_review_records_card_user`);
  await executeQuery(`CREATE UNIQUE INDEX IF NOT EXISTS idx_review_records_card_user ON review_records(card_id, user_id)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_review_records_due_date ON review_records(due_date)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_session_logs_card_id ON session_logs(card_id)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_session_logs_reviewed_at ON session_logs(reviewed_at)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id)`);

  // -- Alter existing tables to add columns if missing --
  await executeQuery(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'N5'`);
  await executeQuery(`ALTER TABLE review_records ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
  await executeQuery(`ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
}
