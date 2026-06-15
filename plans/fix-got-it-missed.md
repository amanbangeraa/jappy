# Fix: "Got It" / "Missed" Not Working

## Problem Summary

When a user grades a card as "got it" or "missed", the grade is **not persisted** to the database. This means:
- Missed cards never reappear for review
- No cards are tracked as right/wrong
- Summary always shows 0 reviews

## Root Cause

Two issues in [`api/review.ts`](api/review.ts):

1. **Multi-statement SQL**: The POST handler at [line 109-119](api/review.ts:109) sends two SQL statements in one query string (an `INSERT ... ON CONFLICT` followed by `INSERT INTO session_logs`). The Neon HTTP SQL endpoint only executes the **first** statement and silently discards the second. Depending on Neon's behavior, neither insert may succeed.

2. **Missing migrations**: [`api/review.ts`](api/review.ts:39) has the comment `"Migrations removed from request path for performance"`. If `api/lessons.ts` was never called before `api/review.ts`, the `review_records` and `session_logs` tables may not exist at all.

## Fix Plan

### Step 1: Fix [`api/review.ts`](api/review.ts) — POST handler

Split the single multi-statement query into **two separate `sql` calls**:

```ts
// First: upsert the review record
await sql`
  INSERT INTO review_records (card_id, interval, ease_factor, repetitions, due_date)
  VALUES (${cardId}, ${interval}, ${easeFactor}, ${repetitions}, ${dueDate})
  ON CONFLICT (card_id) DO UPDATE SET
    interval = ${interval},
    ease_factor = ${easeFactor},
    repetitions = ${repetitions},
    due_date = ${dueDate}
`;

// Second: insert the session log
await sql`
  INSERT INTO session_logs (card_id, grade, reviewed_at)
  VALUES (${cardId}, ${grade}, ${Date.now()})
`;
```

### Step 2: Add `runMigrations()` to [`api/review.ts`](api/review.ts)

Add `await runMigrations()` at the top of the handler, matching the pattern used in [`api/lessons.ts`](api/lessons.ts:30). This ensures the `review_records` and `session_logs` tables exist before any review operations.

### Step 3: Surface errors in [`useSession.ts`](src/hooks/useSession.ts)

The current fire-and-forget pattern silently swallows API errors. Change the `.catch()` handler to also track failures in the results so the user sees them. Additionally, consider making the `gradeCard` function await the API call so navigation doesn't happen until persistence is confirmed.

---

## Affected Files

| File | Change |
|------|--------|
| [`api/review.ts`](api/review.ts) | Split multi-statement SQL into two calls; add `runMigrations()` |
| [`src/hooks/useSession.ts`](src/hooks/useSession.ts) | Improve error handling and optionally await API call |

## Data Flow After Fix

```mermaid
flowchart TD
    A[User taps Got it or Missed] --> B[gradeCard in useSession.ts]
    B --> C[updateReview in sm2.ts: compute new interval/ease/due]
    C --> D[POST /api/review]
    D --> E[runMigrations: ensure tables exist]
    E --> F["sql 1: UPSERT review_records"]
    F --> G["sql 2: INSERT session_logs"]
    G --> H[Response: { ok: true }]
    H --> I{grade < 2?}
    I -->|Yes - missed| J[Re-queue card at end of session queue]
    I -->|No - got it| K[Card done, advance to next]
    J --> K
    K --> L{More cards?}
    L -->|Yes| A
    L -->|No| M[buildSummary → navigate to /summary]