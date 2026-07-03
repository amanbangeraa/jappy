import { neon } from '@neondatabase/serverless';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

function getConnectionString() {
  return process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'lesson';
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(',');
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','));
  return [header, ...lines].join('\n') + '\n';
}

function assertSafeIdentifier(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
}

async function exportTable(sql, tableName, outDir) {
  assertSafeIdentifier(tableName);

  const colRows = await sql.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position ASC`,
    [tableName],
  );

  const columns = colRows.map((r) => r.column_name);
  if (columns.length === 0) {
    throw new Error(`No columns found for table: ${tableName}`);
  }

  const rows = await sql.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
  const csv = toCsv(rows, columns);
  const filePath = path.join(outDir, `${tableName}.csv`);
  await writeFile(filePath, csv, 'utf8');

  return { tableName, rowCount: rows.length, filePath };
}

async function exportLessonImportFiles(sql, outDir) {
  const rows = await sql.query(`
    SELECT
      l.id AS lesson_id,
      l.name AS lesson_name,
      l.level AS lesson_level,
      c.id AS card_id,
      c.japanese,
      c.english,
      c.reading
    FROM lessons l
    LEFT JOIN cards c ON c.lesson_id = l.id
    ORDER BY l.id ASC, c.id ASC
  `);

  const byLesson = new Map();
  for (const row of rows) {
    const lid = Number(row.lesson_id);
    if (!byLesson.has(lid)) {
      byLesson.set(lid, {
        lessonId: lid,
        lessonName: row.lesson_name,
        lessonLevel: row.lesson_level,
        cards: [],
      });
    }
    if (row.card_id !== null) {
      byLesson.get(lid).cards.push({
        japanese: row.japanese,
        english: row.english,
        reading: row.reading,
      });
    }
  }

  const lessonImportDir = path.join(outDir, 'lesson-import-files');
  await mkdir(lessonImportDir, { recursive: true });

  const manifestRows = [];
  for (const lesson of byLesson.values()) {
    const fileName = `lesson-${lesson.lessonId}-${slugify(lesson.lessonName)}.csv`;
    const csvRows = lesson.cards.map((card) => ({
      japanese: card.japanese,
      english: card.english,
      reading: card.reading ?? '',
    }));

    const csv = toCsv(csvRows, ['japanese', 'english', 'reading']);
    await writeFile(path.join(lessonImportDir, fileName), csv, 'utf8');

    manifestRows.push({
      lesson_id: lesson.lessonId,
      lesson_name: lesson.lessonName,
      level: lesson.lessonLevel,
      total_cards: lesson.cards.length,
      file_name: fileName,
    });
  }

  const manifestCsv = toCsv(manifestRows, ['lesson_id', 'lesson_name', 'level', 'total_cards', 'file_name']);
  await writeFile(path.join(lessonImportDir, 'manifest.csv'), manifestCsv, 'utf8');

  return {
    lessonCount: manifestRows.length,
    outputDir: lessonImportDir,
  };
}

async function main() {
  await loadEnvFromFiles();

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Set DATABASE_URL in .env.local (or .env), or export DATABASE_URL/DATABASE_URL_UNPOOLED before running export.');
  }

  const sql = neon(connectionString);

  const baseOutArg = process.argv[2] || path.join('exports', `db-export-${nowStamp()}`);
  const baseOutDir = path.resolve(process.cwd(), baseOutArg);
  await mkdir(baseOutDir, { recursive: true });

  const preferred = ['users', 'sessions', 'lessons', 'cards', 'review_records', 'session_logs'];
  const tableRows = await sql.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );

  const existing = new Set(tableRows.map((r) => r.table_name));
  const orderedTables = [
    ...preferred.filter((t) => existing.has(t)),
    ...Array.from(existing).filter((t) => !preferred.includes(t)).sort(),
  ];

  if (orderedTables.length === 0) {
    throw new Error('No tables found in public schema.');
  }

  const results = [];
  for (const table of orderedTables) {
    const exported = await exportTable(sql, table, baseOutDir);
    results.push(exported);
  }

  let lessonImportSummary = null;
  if (existing.has('lessons') && existing.has('cards')) {
    lessonImportSummary = await exportLessonImportFiles(sql, baseOutDir);
  }

  const report = {
    exportedAt: Date.now(),
    outputDir: baseOutDir,
    tables: results.map((r) => ({
      table: r.tableName,
      rows: r.rowCount,
      file: path.relative(process.cwd(), r.filePath),
    })),
    lessonImportFiles: lessonImportSummary,
  };

  await writeFile(path.join(baseOutDir, 'export-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`Export complete: ${path.relative(process.cwd(), baseOutDir)}`);
  for (const row of report.tables) {
    console.log(`- ${row.table}: ${row.rows} rows -> ${row.file}`);
  }
  if (lessonImportSummary) {
    console.log(`- lesson import files: ${lessonImportSummary.lessonCount} lessons -> ${path.relative(process.cwd(), lessonImportSummary.outputDir)}`);
  }
}

main().catch((error) => {
  console.error('Export failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
