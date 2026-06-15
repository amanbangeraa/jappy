import { sql, runMigrations, executeQuery } from '../src/db/neon';

export const config = { runtime: 'edge' };

interface LessonRow {
  id: number;
  name: string;
  level: string;
  imported_at: number;
}

interface LessonStats {
  totalCards: number;
  dueCards: number;
  lastStudied: number | null;
}

export default async function handler(req: any, res?: any): Promise<any> {
  const sendResponse = (data: any, status = 200) => {
    if (res && typeof res.status === 'function') {
      return res.status(status).json(data);
    }
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };

  let id: string | null = null;
  let level: string | null = null;

  try {
    await runMigrations();
    id = req.query?.id ?? new URL(req.url || '', 'http://localhost').searchParams.get('id');
    level = req.query?.level ?? new URL(req.url || '', 'http://localhost').searchParams.get('level');
  } catch (err) {
    console.error('Initialization error:', err);
    return sendResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  // ── GET /api/lessons — list all lessons with stats ──
  if (req.method === 'GET') {
    try {
      if (id) {
        const rows = await sql`SELECT * FROM lessons WHERE id = ${Number(id)}`;
        const lesson = rows as unknown as LessonRow[];
        if (lesson.length === 0) {
          return sendResponse({ error: 'Lesson not found' }, 404);
        }
        return sendResponse({
          id: lesson[0].id,
          name: lesson[0].name,
          level: lesson[0].level,
          importedAt: lesson[0].imported_at,
        });
      }

      let rows: unknown[];
      if (level) {
        rows = await sql`SELECT * FROM lessons WHERE level = ${level} ORDER BY imported_at DESC`;
      } else {
        rows = await sql`SELECT * FROM lessons ORDER BY imported_at DESC`;
      }
      const lessons = rows as unknown as LessonRow[];

      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const endOfToday = now.getTime();

      // Enrich each lesson with stats
      const enriched = await Promise.all(
        lessons.map(async (lesson) => {
          const cardRows = await sql`SELECT id FROM cards WHERE lesson_id = ${lesson.id}`;
          const cards = cardRows as unknown as { id: number }[];
          const totalCards = cards.length;
          const cardIds = cards.map((c) => c.id);

          let dueCards = 0;
          if (cardIds.length > 0) {
            const reviewRows = await sql`SELECT card_id FROM review_records WHERE card_id = ANY(${cardIds})`;
            const reviewed = reviewRows as unknown as { card_id: number }[];
            const reviewedIds = new Set(reviewed.map((r) => r.card_id));
            const unreviewed = cardIds.filter((cid) => !reviewedIds.has(cid));

            const dueRows = await sql`SELECT card_id FROM review_records WHERE card_id = ANY(${cardIds}) AND due_date <= ${endOfToday}`;
            const due = dueRows as unknown as { card_id: number }[];
            const dueRecordIds = new Set(due.map((r) => r.card_id));
            dueCards = unreviewed.length + dueRecordIds.size;
          }

          // last studied
          let lastStudied: number | null = null;
          if (cardIds.length > 0) {
            const logRows = await sql`SELECT reviewed_at FROM session_logs WHERE card_id = ANY(${cardIds}) ORDER BY reviewed_at DESC LIMIT 1`;
            const logs = logRows as unknown as { reviewed_at: number }[];
            lastStudied = logs.length > 0 ? logs[0].reviewed_at : null;
          }

          const stats: LessonStats = { totalCards, dueCards, lastStudied };
          return { id: lesson.id, name: lesson.name, level: lesson.level, importedAt: lesson.imported_at, stats };
        })
      );

      return sendResponse(enriched);
    } catch (err) {
      console.error('GET /api/lessons error:', err);
      return sendResponse({ error: 'Failed to fetch lessons' }, 500);
    }
  }

  // ── POST /api/lessons — import new lesson from CSV data ──
  if (req.method === 'POST') {
    try {
      const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : await req.json();
      const { name, level: lessonLevel, cards: rows } = body as {
        name: string;
        level: string;
        cards: { japanese: string; english: string; reading?: string }[];
      };

      if (!name || !rows || rows.length === 0) {
        return sendResponse({ error: 'Missing name or cards' }, 400);
      }

      const validLevels = ['N1', 'N2', 'N3', 'N4', 'N5'];
      const actualLevel = validLevels.includes(lessonLevel) ? lessonLevel : 'N5';

      // Check for duplicate
      const existingRows = await sql`SELECT id FROM lessons WHERE name = ${name}`;
      const existing = existingRows as unknown as { id: number }[];
      if (existing.length > 0) {
        return sendResponse({ error: `"${name}" already exists` }, 409);
      }

      // Insert lesson (no transaction — Neon HTTP endpoint uses connection-per-request)
      const result = await sql`INSERT INTO lessons (name, level, imported_at) VALUES (${name}, ${actualLevel}, ${Date.now()}) RETURNING id, name, level, imported_at`;
      const lesson = result as unknown as LessonRow[];
      const lessonId = lesson[0].id;

      // Bulk insert cards in batches to avoid per-row HTTP round-trips
      const BATCH = 1000;
      try {
        const insertPromises = [];
        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const values: string[] = [];
          const params: unknown[] = [];
          let idx = 0;
          for (const row of chunk) {
            values.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
            params.push(lessonId, row.japanese, row.english, row.reading ?? null);
            idx += 4;
          }
          insertPromises.push(executeQuery(`INSERT INTO cards (lesson_id, japanese, english, reading) VALUES ${values.join(', ')}`, params));
        }
        await Promise.all(insertPromises);
      } catch (cardErr) {
        // Cleanup: delete the lesson if card inserts fail
        await sql`DELETE FROM lessons WHERE id = ${lessonId}`;
        throw cardErr;
      }

      return sendResponse({
        id: lesson[0].id,
        name: lesson[0].name,
        level: lesson[0].level,
        importedAt: lesson[0].imported_at,
        stats: {
          totalCards: rows.length,
          dueCards: rows.length,
          lastStudied: null,
        },
      }, 201);
    } catch (err) {
      console.error('POST /api/lessons error:', err);
      return sendResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  // ── DELETE /api/lessons?id=X ──
  if (req.method === 'DELETE' && id) {
    try {
      await sql`DELETE FROM lessons WHERE id = ${Number(id)}`;
      return sendResponse({ ok: true });
    } catch (err) {
      console.error('DELETE /api/lessons error:', err);
      return sendResponse({ error: 'Failed to delete lesson' }, 500);
    }
  }

  return sendResponse({ error: 'Method not allowed' }, 405);
}