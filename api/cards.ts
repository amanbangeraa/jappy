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

export default async function handler(req: Request): Promise<Response> {
// Migrations removed from request path for performance

  const url = new URL(req.url);
  const lessonId = url.searchParams.get('lessonId');

  // ── GET /api/cards?lessonId=X — get cards for a lesson with review data ──
  if (req.method === 'GET') {
    try {
      if (!lessonId) {
        return Response.json({ error: 'lessonId query param required' }, { status: 400 });
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

      return Response.json(enriched);
    } catch (err) {
      console.error('GET /api/cards error:', err);
      return Response.json({ error: 'Failed to fetch cards' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}