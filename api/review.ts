import { sql, runMigrations } from '../src/db/neon';

export const config = { runtime: 'edge' };

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
  interval: number;
  ease_factor: number;
  repetitions: number;
  due_date: number;
}

interface GradeRequest {
  cardId: number;
  grade: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  dueDate: number;
}

export default async function handler(req: Request): Promise<Response> {
// Migrations removed from request path for performance

  const url = new URL(req.url);
  const lessonId = url.searchParams.get('lessonId');

  // ── GET /api/review?lessonId=X — get due cards ──
  if (req.method === 'GET') {
    try {
      if (!lessonId) {
        return Response.json({ error: 'lessonId query param required' }, { status: 400 });
      }

      const lid = Number(lessonId);
      const cardRows = await sql`SELECT * FROM cards WHERE lesson_id = ${lid}`;
      const cards = cardRows as unknown as CardRow[];

      const cardIds = cards.map((c) => c.id);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const endOfToday = now.getTime();

      let reviews: ReviewRow[] = [];
      if (cardIds.length > 0) {
        const reviewRows = await sql`SELECT * FROM review_records WHERE card_id = ANY(${cardIds})`;
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

      return Response.json(dueCards);
    } catch (err) {
      console.error('GET /api/review error:', err);
      return Response.json({ error: 'Failed to fetch due cards' }, { status: 500 });
    }
  }

  // ── POST /api/review — grade a card ──
  if (req.method === 'POST') {
    try {
      const body = await req.json() as GradeRequest;
      const { cardId, grade, interval, easeFactor, repetitions, dueDate } = body;

      // Single multi-statement query: upsert review record + log session (1 curl call)
      await sql`
        INSERT INTO review_records (card_id, interval, ease_factor, repetitions, due_date)
        VALUES (${cardId}, ${interval}, ${easeFactor}, ${repetitions}, ${dueDate})
        ON CONFLICT (card_id) DO UPDATE SET
          interval = ${interval},
          ease_factor = ${easeFactor},
          repetitions = ${repetitions},
          due_date = ${dueDate};
        INSERT INTO session_logs (card_id, grade, reviewed_at)
        VALUES (${cardId}, ${grade}, ${Date.now()})
      `;

      return Response.json({ ok: true });
    } catch (err) {
      console.error('POST /api/review error:', err);
      return Response.json({ error: 'Failed to save review' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}