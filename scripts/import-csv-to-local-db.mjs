import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TABLE_ORDER = ['users', 'sessions', 'lessons', 'cards', 'review_records', 'session_logs'];
const REVERSE_TABLE_ORDER = [...TABLE_ORDER].reverse();

function getConnectionString() {
  return process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || '';
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseEnvLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) return null;

  const eq = line.indexOf('=');
  if (eq <= 0) return null;

  const key = line.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = line.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function loadEnvFromFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, '.env.local'),
    path.join(cwd, '.env'),
  ];

  for (const filePath of candidates) {
    if (!(await pathExists(filePath))) continue;

    const text = await readFile(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (!process.env[parsed.key]) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

async function resolveExportDir(inputArg) {
  if (inputArg) {
    return path.resolve(process.cwd(), inputArg);
  }

  const exportsDir = path.resolve(process.cwd(), 'exports');
  if (!(await pathExists(exportsDir))) {
    throw new Error('No exports directory found. Provide a path argument to an export folder.');
  }

  const names = await readdir(exportsDir);
  const candidates = [];
  for (const name of names) {
    if (!name.startsWith('db-export-')) continue;
    const full = path.join(exportsDir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      candidates.push({ full, mtime: info.mtimeMs });
    }
  }

  if (candidates.length === 0) {
    throw new Error('No export folders found under exports/. Run the export command first.');
  }

  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].full;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseHeaderColumns(csvText) {
  const firstLine = csvText.split(/\r?\n/, 1)[0] || '';
  return firstLine
    .split(',')
    .map((col) => col.trim())
    .filter(Boolean);
}

function assertSafeColumnName(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe CSV column name: ${name}`);
  }
}

async function buildImportSql(exportDir, tableFiles) {
  const chunks = [];

  chunks.push('BEGIN;');
  chunks.push('SET client_min_messages TO WARNING;');

  chunks.push(`
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  created_at    BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  created_at    BIGINT NOT NULL DEFAULT 0,
  expires_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  level       TEXT NOT NULL DEFAULT 'N5',
  imported_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cards (
  id          SERIAL PRIMARY KEY,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  japanese    TEXT NOT NULL,
  english     TEXT NOT NULL,
  reading     TEXT
);

CREATE TABLE IF NOT EXISTS review_records (
  id            SERIAL PRIMARY KEY,
  card_id       INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  interval      REAL NOT NULL DEFAULT 0,
  ease_factor   REAL NOT NULL DEFAULT 2.5,
  repetitions   INTEGER NOT NULL DEFAULT 0,
  due_date      BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_logs (
  id          SERIAL PRIMARY KEY,
  card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  grade       SMALLINT NOT NULL,
  reviewed_at BIGINT NOT NULL
);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'N5';
ALTER TABLE review_records ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_cards_lesson_id ON cards(lesson_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_records_card_user ON review_records(card_id, user_id);
CREATE INDEX IF NOT EXISTS idx_review_records_due_date ON review_records(due_date);
CREATE INDEX IF NOT EXISTS idx_session_logs_card_id ON session_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_reviewed_at ON session_logs(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id);
`);

  for (const table of REVERSE_TABLE_ORDER) {
    if (tableFiles.has(table)) {
      chunks.push(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
    }
  }

  for (const table of TABLE_ORDER) {
    const filePath = tableFiles.get(table);
    if (!filePath) continue;

    const csvText = await readFile(filePath, 'utf8');
    const columns = parseHeaderColumns(csvText);
    if (columns.length === 0) {
      throw new Error(`CSV has no header columns: ${filePath}`);
    }

    for (const column of columns) {
      assertSafeColumnName(column);
    }

    const quotedColumns = columns.join(', ');
    chunks.push(`\\copy ${table} (${quotedColumns}) FROM ${shellQuote(filePath)} WITH (FORMAT csv, HEADER true)`);
  }

  chunks.push(`UPDATE cards SET reading = NULL WHERE reading = '';`);

  for (const table of TABLE_ORDER) {
    if (!tableFiles.has(table)) continue;
    chunks.push(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0), true);`);
  }

  chunks.push('COMMIT;');
  chunks.push('');

  return chunks.join('\n');
}

function runPsql(connectionString, sqlFilePath) {
  const check = spawnSync('psql', ['--version'], { stdio: 'ignore' });
  if (check.error) {
    throw new Error('psql is not installed. Install PostgreSQL client tools first.');
  }

  const result = spawnSync('psql', [connectionString, '-v', 'ON_ERROR_STOP=1', '-f', sqlFilePath], {
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`psql exited with status ${result.status}`);
  }
}

async function main() {
  await loadEnvFromFiles();

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Set LOCAL_DATABASE_URL in .env.local (or .env), or export LOCAL_DATABASE_URL before running import.');
  }

  const exportDir = await resolveExportDir(process.argv[2]);
  const tableFiles = new Map();

  for (const table of TABLE_ORDER) {
    const filePath = path.join(exportDir, `${table}.csv`);
    if (await pathExists(filePath)) {
      tableFiles.set(table, filePath);
    }
  }

  if (tableFiles.size === 0) {
    throw new Error(`No known table CSV files found in ${exportDir}`);
  }

  const importSql = await buildImportSql(exportDir, tableFiles);
  const sqlFilePath = path.join(tmpdir(), `jappy-import-${randomUUID()}.sql`);
  await writeFile(sqlFilePath, importSql, 'utf8');

  console.log(`Import source: ${path.relative(process.cwd(), exportDir) || exportDir}`);
  console.log(`Tables to import: ${Array.from(tableFiles.keys()).join(', ')}`);
  runPsql(connectionString, sqlFilePath);
  console.log('Import complete. Your local database now contains the exported data.');
}

main().catch((error) => {
  console.error('Import failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
