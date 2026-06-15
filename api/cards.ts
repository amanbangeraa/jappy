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

export default async function handler(req: any, res?: any): Promise<any> {
  const sendResponse = (data: any, status = 200) => {
    if (res) return res.status(status).json(data);
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };

// Migrations removed from request path for performance

  let lessonId: string | null = null;

  try {
    lessonId = req.query?.lessonId ?? new URL(req.url || '', 'http://localhost').searchParams.get('lessonId');
  } catch (err) {
    console.error('Initialization error:', err);
    return sendResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  // ── GET /api/cards?lessonId=X — get cards for a lesson with review data ──
  if (req.method === 'GET') {
    try {
      if (!lessonId) {
        return sendResponse({ error: 'lessonId query param required' }, 400);
      }

      const lid = Number(lessonId);
      const cardRows = await sql`SELECT * FROM cards WHERE lesson_id = ${lid}`;
      const cards = cardRows as unknown as CardRow[];

      const cardIds = cards.map((c) => c.id);
      let reviews: ReviewRow[] = [];
      if (cardIds.length > 0) {
        const reviewRows = await sql`SELECT * FROM review_records WHERE card_id = ANY(${cardIds})`;
        reviews = reviewRows as unknown as ReviewRow[];
      }
      const reviewMap = new Map(reviews.map((r) => [r.card_id, r]));

      const enriched = cards.map((card) => {
        const review = reviewMap.get(card.id);
        return {
          id: card.id,
          lessonId: card.lesson_id,
          japanese: card.japanese,
          english: card.english,
          reading: card.reading,
          review: review ? {
            id: review.id,
            cardId: review.card_id,
            interval: review.interval,
            easeFactor: review.ease_factor,
            repetitions: review.repetitions,
            dueDate: review.due_date,
          } : null,
        };
      });

      return sendResponse(enriched);
    } catch (err) {
      console.error('GET /api/cards error:', err);
      return sendResponse({ error: 'Failed to fetch cards' }, 500);
    }
  }

  return sendResponse({ error: 'Method not allowed' }, 405);
}