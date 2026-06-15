import type { Grade, ReviewRecord } from '../types';

// Two-grade system: miss = 0, got = 2
export const QUALITY_MAP: Record<string, Grade> = {
  miss:  0,
  got:   2,
  // legacy keys for backward compat
  again: 0,
  hard:  1,
  good:  2,
  easy:  3,
};

// ── Constants ────────────────────────────────────────────────────────────────
const INITIAL_EASE    = 2.0;   // Starting multiplier (gives ~15, ~30 day schedule)
const EASE_PENALTY    = 0.15;  // How much ease drops on each miss
const EASE_MIN        = 1.3;   // Floor for ease factor
const MS_PER_DAY      = 24 * 60 * 60 * 1000;

// Hardcoded first steps matching user spec: 1 → 3 → 7 → then easeFactor×
// index = repetitions count BEFORE this review
const INTERVAL_STEPS = [1, 3, 7]; // days for rep 0, 1, 2

// ── Main update function ─────────────────────────────────────────────────────
export function updateReview(
  record: ReviewRecord,
  quality: Grade
): ReviewRecord {
  let { interval, repetitions, easeFactor } = record;

  // Initialise easeFactor if it was never set (legacy records may have 2.5)
  // We don't force-reset it so existing streaks aren't disturbed.
  if (!easeFactor || easeFactor <= 0) easeFactor = INITIAL_EASE;

  if (quality < 2) {
    // ── MISS ──────────────────────────────────────────────────────────────
    // Reset streak
    repetitions = 0;
    interval    = 1;

    // Ease factor only goes DOWN, never up
    easeFactor  = Math.max(easeFactor - EASE_PENALTY, EASE_MIN);

    // Due TOMORROW — "you'll see it again tomorrow regardless"
    const dueDate = Date.now() + interval * MS_PER_DAY;

    return { ...record, interval, repetitions, easeFactor, dueDate };
  }

  // ── GOT IT ────────────────────────────────────────────────────────────────
  // Use the hardcoded step for the first few reps, then multiply by ease factor
  if (repetitions < INTERVAL_STEPS.length) {
    interval = INTERVAL_STEPS[repetitions]; // 1, 3, or 7 days
  } else {
    // Beyond step 3: grow by ease factor (~2.0 → 14, 28, 56 …)
    interval = Math.round(interval * easeFactor);
  }

  repetitions += 1;

  // Ease factor stays STABLE on a correct answer in a binary system.
  // (No "easy" grade to reward, no reason to push it up.)

  const dueDate = Date.now() + interval * MS_PER_DAY;

  return { ...record, interval, repetitions, easeFactor, dueDate };
}

// ── Factory for brand-new cards ───────────────────────────────────────────
export function freshRecord(cardId: number): ReviewRecord {
  return {
    cardId,
    interval:    1,
    easeFactor:  INITIAL_EASE,
    repetitions: 0,
    dueDate:     0, // 0 = never reviewed = always due
  };
}