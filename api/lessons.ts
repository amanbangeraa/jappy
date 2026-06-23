import { sql, runMigrations, executeQuery } from '../src/db/neon.js';
import { verifyToken } from './auth.js';

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

export default async function handler(req: Request): Promise<Response> {
  const sendResponse = (data: unknown, status = 200) => {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };

  let id: string | null;
  let level: string | null;

  try {
    await runMigrations();
    const url = new URL(req.url || '', 'http://localhost');
    id = url.searchParams.get('id');
    level = url.searchParams.get('level');
  } catch (err) {
    console.error('Initialization error:', err);
    return sendResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  // ── GET /api/lessons — list all lessons with stats (user-scoped when authenticated) ──
  if (req.method === 'GET') {
    try {
      // Try to get auth — if present, scope stats to user; if not, return global stats
      let auth: { userId: number; role: string } | null = null;
      try {
        auth = await verifyToken(req);
      } catch {
        // No auth token or invalid — proceed without user scoping
      }

      if (id) {
        const lessonId = Number(id);
        if (!Number.isInteger(lessonId) || lessonId <= 0) {
          return sendResponse({ error: 'id must be a positive integer' }, 400);
        }

        const rows = await sql`SELECT * FROM lessons WHERE id = ${lessonId}`;
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

      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const endOfToday = now.getTime();
      const levelFilter = level ? 'WHERE l.level = $1' : '';
      const baseParams: unknown[] = level ? [level] : [];

      if (level) {
        const validLevels = ['N1', 'N2', 'N3', 'N4', 'N5'];
        if (!validLevels.includes(level)) {
          return sendResponse({ error: 'Invalid JLPT level' }, 400);
        }
      }

      const query = auth
        ? `
          SELECT
            l.id,
            l.name,
            l.level,
            l.imported_at,
            COUNT(c.id)::int AS total_cards,
            COUNT(c.id) FILTER (WHERE rr.id IS NULL OR rr.due_date <= $${baseParams.length + 1})::int AS due_cards,
            MAX(sl.reviewed_at) AS last_studied
          FROM lessons l
          LEFT JOIN cards c ON c.lesson_id = l.id
          LEFT JOIN review_records rr ON rr.card_id = c.id AND rr.user_id = $${baseParams.length + 2}
          LEFT JOIN session_logs sl ON sl.card_id = c.id AND sl.user_id = $${baseParams.length + 2}
          ${levelFilter}
          GROUP BY l.id, l.name, l.level, l.imported_at
          ORDER BY l.imported_at DESC
        `
        : `
          SELECT
            l.id,
            l.name,
            l.level,
            l.imported_at,
            COUNT(c.id)::int AS total_cards,
            COUNT(c.id) FILTER (WHERE rr.id IS NULL OR rr.due_date <= $${baseParams.length + 1})::int AS due_cards,
            MAX(sl.reviewed_at) AS last_studied
          FROM lessons l
          LEFT JOIN cards c ON c.lesson_id = l.id
          LEFT JOIN review_records rr ON rr.card_id = c.id
          LEFT JOIN session_logs sl ON sl.card_id = c.id
          ${levelFilter}
          GROUP BY l.id, l.name, l.level, l.imported_at
          ORDER BY l.imported_at DESC
        `;

      const params = auth ? [...baseParams, endOfToday, auth.userId] : [...baseParams, endOfToday];
      const rows = await executeQuery<LessonRow & { total_cards: number; due_cards: number; last_studied: number | null }>(query, params);
      const enriched = rows.rows.map((lesson) => ({
        id: lesson.id,
        name: lesson.name,
        level: lesson.level,
        importedAt: lesson.imported_at,
        stats: {
          totalCards: Number(lesson.total_cards),
          dueCards: Number(lesson.due_cards),
          lastStudied: lesson.last_studied === null ? null : Number(lesson.last_studied),
        } satisfies LessonStats,
      }));

      return sendResponse(enriched);
    } catch (err) {
      console.error('GET /api/lessons error:', err);
      return sendResponse({ error: 'Failed to fetch lessons' }, 500);
    }
  }

  // ── POST /api/lessons — import new lesson (admin only) ──
  if (req.method === 'POST') {
    try {
      const auth = await verifyToken(req);
      if (!auth) {
        return sendResponse({ error: 'Not authenticated' }, 401);
      }
      if (auth.role !== 'admin') {
        return sendResponse({ error: 'Admin access required' }, 403);
      }

      const body = await req.json();
      const { name, level: lessonLevel, cards: rows } = body as {
        name: string;
        level: string;
        cards: { japanese: string; english: string; reading?: string }[];
      };

      if (!name || !rows || rows.length === 0) {
        return sendResponse({ error: 'Missing name or cards' }, 400);
      }
      if (rows.length > 5000) {
        return sendResponse({ error: 'A lesson can contain at most 5000 cards' }, 400);
      }
      if (typeof name !== 'string' || name.trim().length < 1 || name.length > 120) {
        return sendResponse({ error: 'Lesson name must be 1-120 characters' }, 400);
      }
      if (!rows.every((row) => typeof row.japanese === 'string' && row.japanese.trim() && typeof row.english === 'string' && row.english.trim())) {
        return sendResponse({ error: 'Each card requires japanese and english text' }, 400);
      }

      const validLevels = ['N1', 'N2', 'N3', 'N4', 'N5'];
      const actualLevel = validLevels.includes(lessonLevel) ? lessonLevel : 'N5';

      // Check for duplicate
      const cleanName = name.trim();
      const existingRows = await sql`SELECT id FROM lessons WHERE name = ${cleanName}`;
      const existing = existingRows as unknown as { id: number }[];
      if (existing.length > 0) {
        return sendResponse({ error: `"${name}" already exists` }, 409);
      }

      // Insert lesson
      const result = await sql`INSERT INTO lessons (name, level, imported_at) VALUES (${cleanName}, ${actualLevel}, ${Date.now()}) RETURNING id, name, level, imported_at`;
      const lesson = result as unknown as LessonRow[];
      const lessonId = lesson[0].id;

      // Bulk insert cards in batches
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
            params.push(lessonId, row.japanese.trim(), row.english.trim(), row.reading?.trim() || null);
            idx += 4;
          }
          insertPromises.push(executeQuery(`INSERT INTO cards (lesson_id, japanese, english, reading) VALUES ${values.join(', ')}`, params));
        }
        await Promise.all(insertPromises);
      } catch (cardErr) {
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

  // ── DELETE /api/lessons?id=X (admin only) ──
  if (req.method === 'DELETE' && id) {
    try {
      const auth = await verifyToken(req);
      if (!auth) {
        return sendResponse({ error: 'Not authenticated' }, 401);
      }
      if (auth.role !== 'admin') {
        return sendResponse({ error: 'Admin access required' }, 403);
      }

      const lessonId = Number(id);
      if (!Number.isInteger(lessonId) || lessonId <= 0) {
        return sendResponse({ error: 'id must be a positive integer' }, 400);
      }

      await sql`DELETE FROM lessons WHERE id = ${lessonId}`;
      return sendResponse({ ok: true });
    } catch (err) {
      console.error('DELETE /api/lessons error:', err);
      return sendResponse({ error: 'Failed to delete lesson' }, 500);
    }
  }

  return sendResponse({ error: 'Method not allowed' }, 405);
}