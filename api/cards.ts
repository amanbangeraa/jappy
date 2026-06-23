import { sql, runMigrations } from '../src/db/neon.js';
import { verifyToken } from './auth.js';
import { adaptHandler } from './http.js';

interface CardRow {
  id: number;
  lesson_id: number;
  japanese: string;
  english: string;
  reading: string | null;
}

interface ReviewRow {
  id: number;
  card_id: number;
  user_id: number | null;
  interval: number;
  ease_factor: number;
  repetitions: number;
  due_date: number;
}

async function cardsHandler(req: Request): Promise<Response> {
  const sendResponse = (data: unknown, status = 200) => {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };

  let lessonId: string | null;

  try {
    await runMigrations();
    lessonId = new URL(req.url || '', 'http://localhost').searchParams.get('lessonId');
  } catch (err) {
    console.error('Initialization error:', err);
    return sendResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  // ── GET /api/cards?lessonId=X — get cards for a lesson with review data (user-scoped) ──
  if (req.method === 'GET') {
    try {
      const auth = await verifyToken(req);
      if (!auth) {
        return sendResponse({ error: 'Not authenticated' }, 401);
      }

      if (!lessonId) {
        return sendResponse({ error: 'lessonId query param required' }, 400);
      }

      const lid = Number(lessonId);
      if (!Number.isInteger(lid) || lid <= 0) {
        return sendResponse({ error: 'lessonId must be a positive integer' }, 400);
      }

      const rows = await sql`
        SELECT
          c.id,
          c.lesson_id,
          c.japanese,
          c.english,
          c.reading,
          rr.id AS review_id,
          rr.interval,
          rr.ease_factor,
          rr.repetitions,
          rr.due_date
        FROM cards c
        LEFT JOIN review_records rr ON rr.card_id = c.id AND rr.user_id = ${auth.userId}
        WHERE c.lesson_id = ${lid}
        ORDER BY c.id
      `;
      const enriched = (rows as unknown as (CardRow & Partial<ReviewRow> & { review_id: number | null })[]).map((card) => ({
        id: card.id,
        lessonId: card.lesson_id,
        japanese: card.japanese,
        english: card.english,
        reading: card.reading,
        review: card.review_id ? {
          id: card.review_id,
          cardId: card.id,
          interval: Number(card.interval),
          easeFactor: Number(card.ease_factor),
          repetitions: Number(card.repetitions),
          dueDate: Number(card.due_date),
        } : null,
      }));

      return sendResponse(enriched);
    } catch (err) {
      console.error('GET /api/cards error:', err);
      return sendResponse({ error: 'Failed to fetch cards' }, 500);
    }
  }

  return sendResponse({ error: 'Method not allowed' }, 405);
}

export default adaptHandler(cardsHandler);