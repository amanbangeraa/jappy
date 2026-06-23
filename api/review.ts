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

async function reviewHandler(req: Request): Promise<Response> {
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

  // ── GET /api/review?lessonId=X — get due cards (user-scoped) ──
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

      const cardRows = await sql`SELECT * FROM cards WHERE lesson_id = ${lid}`;
      const cards = cardRows as unknown as CardRow[];

      const cardIds = cards.map((c) => c.id);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const endOfToday = now.getTime();

      let reviews: ReviewRow[] = [];
      if (cardIds.length > 0) {
        const reviewRows = await sql`SELECT * FROM review_records WHERE card_id = ANY(${cardIds}) AND user_id = ${auth.userId}`;
        reviews = reviewRows as unknown as ReviewRow[];
      }
      const reviewMap = new Map(reviews.map((r) => [r.card_id, r]));

      // Due = no review record OR dueDate <= endOfToday
      const dueCards = cards
        .map((card) => {
          const review = reviewMap.get(card.id);
          return {
            id: card.id,
            lessonId: card.lesson_id,
            japanese: card.japanese,
            english: card.english,
            reading: card.reading,
            dueDate: review ? review.due_date : 0,
            interval: review ? review.interval : 1,
            easeFactor: review ? review.ease_factor : 2.0,
            repetitions: review ? review.repetitions : 0,
          };
        })
        .filter((card) => {
          const review = reviewMap.get(card.id);
          if (!review) return true;
          return review.due_date <= endOfToday;
        });

      return sendResponse(dueCards);
    } catch (err) {
      console.error('GET /api/review error:', err);
      return sendResponse({ error: 'Failed to fetch due cards' }, 500);
    }
  }

  // ── POST /api/review — grade a card (user-scoped) ──
  if (req.method === 'POST') {
    try {
      const auth = await verifyToken(req);
      if (!auth) {
        return sendResponse({ error: 'Not authenticated' }, 401);
      }

      const body = await req.json();
      const { cardId, grade, interval, easeFactor, repetitions, dueDate } = body as Record<string, unknown>;
      const numeric = {
        cardId: Number(cardId),
        grade: Number(grade),
        interval: Number(interval),
        easeFactor: Number(easeFactor),
        repetitions: Number(repetitions),
        dueDate: Number(dueDate),
      };

      if (!Number.isInteger(numeric.cardId) || numeric.cardId <= 0) {
        return sendResponse({ error: 'cardId must be a positive integer' }, 400);
      }
      if (!Number.isInteger(numeric.grade) || numeric.grade < 0 || numeric.grade > 3) {
        return sendResponse({ error: 'grade must be an integer from 0 to 3' }, 400);
      }
      if (!Number.isFinite(numeric.interval) || numeric.interval < 0 || numeric.interval > 36500) {
        return sendResponse({ error: 'interval is out of range' }, 400);
      }
      if (!Number.isFinite(numeric.easeFactor) || numeric.easeFactor < 1 || numeric.easeFactor > 5) {
        return sendResponse({ error: 'easeFactor is out of range' }, 400);
      }
      if (!Number.isInteger(numeric.repetitions) || numeric.repetitions < 0 || numeric.repetitions > 10000) {
        return sendResponse({ error: 'repetitions is out of range' }, 400);
      }
      if (!Number.isFinite(numeric.dueDate) || numeric.dueDate < 0) {
        return sendResponse({ error: 'dueDate is invalid' }, 400);
      }

      const cardRows = await sql`SELECT id FROM cards WHERE id = ${numeric.cardId}`;
      if (cardRows.length === 0) {
        return sendResponse({ error: 'Card not found' }, 404);
      }

      // Upsert the review record with user_id
      await sql`
        INSERT INTO review_records (card_id, user_id, interval, ease_factor, repetitions, due_date)
        VALUES (${numeric.cardId}, ${auth.userId}, ${numeric.interval}, ${numeric.easeFactor}, ${numeric.repetitions}, ${numeric.dueDate})
        ON CONFLICT (card_id, user_id) DO UPDATE SET
          interval = ${numeric.interval},
          ease_factor = ${numeric.easeFactor},
          repetitions = ${numeric.repetitions},
          due_date = ${numeric.dueDate}
      `;

      await sql`
        INSERT INTO session_logs (card_id, user_id, grade, reviewed_at)
        VALUES (${numeric.cardId}, ${auth.userId}, ${numeric.grade}, ${Date.now()})
      `;

      return sendResponse({ ok: true });
    } catch (err) {
      console.error('POST /api/review error:', err);
      return sendResponse({ error: 'Failed to save review' }, 500);
    }
  }

  return sendResponse({ error: 'Method not allowed' }, 405);
}

export default adaptHandler(reviewHandler);