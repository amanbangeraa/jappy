# Fix: "Got It" / "Missed" Not Working — Algorithm Trace

**Status:** ✅ All critical bugs fixed. See action items at bottom.


## Problem Summary

When a user grades a card as "got it" or "missed", grades are not persisted and cards don't follow the correct SRS schedule. After a deep trace, I found **multiple bugs** across the full stack.

---

## Bug 1: Multi-Statement SQL (FIXED)

**File:** [`api/review.ts`](api/review.ts:107-121)

The POST handler sent two SQL statements in a single `sql` call. The Neon HTTP SQL endpoint only executes the first statement — so `INSERT INTO session_logs` was silently dropped.

**Fix applied:** Split into two separate `sql` calls.

---

## Bug 2: Missing Migrations (FIXED)

**Files:** [`api/review.ts`](api/review.ts:42), [`api/cards.ts`](api/cards.ts)

Both files had `// Migrations removed from request path for performance` — meaning `review_records` and `session_logs` tables might not exist if `api/lessons.ts` was never called first.

**Fix applied:** Added `await runMigrations()` to both handlers.

---

## Bug 3 (CRITICAL): Re-queued Card Stale SM2 Data

**File:** [`useSession.ts`](src/hooks/useSession.ts:134-136)

When a card is missed and re-queued, it's pushed with the **original** card data:

```ts
if (grade < 2 && !requeuedRef.current.has(card.id!)) {
  requeuedRef.current.add(card.id!);
  queueRef.current = [...queue, { ...card }];  // <-- ORIGINAL card, NOT updated!
}
```

The `{ ...card }` spread copies the **original** `card` object from the queue, which still has the pre-grade `interval`, `easeFactor`, `repetitions`, and `dueDate`. When the re-queued card comes up again and the user grades it (likely "got it" the second time), `updateReview` receives the **stale** pre-miss values — so the SM2 calculation is wrong.

**Example trace:**
1. Card appears with `{ repetitions: 2, interval: 7, easeFactor: 2.0 }`
2. User taps "Missed" → SM2 resets to `{ repetitions: 0, interval: 1, easeFactor: 1.85 }`
3. Card is re-queued as `{ ...card }` → still has `{ repetitions: 2, interval: 7, easeFactor: 2.0 }` 
4. Card comes up again → user taps "Got it" → SM2 uses stale data → computes `INTERVAL_STEPS[2] = 7` (wrong! should be `INTERVAL_STEPS[0] = 1`)

**Fix:** When re-queuing, use the `updated` record:
```ts
queueRef.current = [...queue, { ...card, interval: updated.interval, easeFactor: updated.easeFactor, repetitions: updated.repetitions, dueDate: updated.dueDate }];
```

---

## Bug 4 (CRITICAL): buildSummary Last-Grade-Wins Logic

**File:** [`useSession.ts`](src/hooks/useSession.ts:65-87)

```ts
const lastGradePerCard = new Map<number, Grade>();
for (const r of results) lastGradePerCard.set(r.cardId, r.grade);

const gotItCount  = [...lastGradePerCard.values()].filter((g) => g >= 2).length;
const missedCount = [...lastGradePerCard.values()].filter((g) => g <  2).length;
```

Since `resultsRef.current` records **every** grade (not just the last), and missed cards get re-queued and graded again (got it on second try), the **last grade** always wins. This means:
- If a card is missed then re-shown and marked "got it": it counts as **got it** (good! that's the final state)
- But: if a card is marked "got it" and the submission fails → user sees "got it" in summary (because last entry is grade=2) — this is the existing behavior

This is actually not a bug in the "last grade wins" logic itself — it's intentional for re-queued cards. However, the **`results` array includes duplicates**, which makes the "Show card details" section in SummaryPage show both the miss and the got for the same card, which may be confusing.

---

## Bug 5: Fire-and-Forget Race Condition with Re-queued Cards

**File:** [`useSession.ts`](src/hooks/useSession.ts:117-131, 133-136)

The `gradeCard` function is not `await`-ed. When a card is missed:

1. `submitGrade` is fired (not awaited)
2. The card is re-queued immediately (line 136)
3. `indexRef` advances immediately (line 146)

If `submitGrade` fails (e.g., network error), the `.catch()` handler removes the result from `resultsRef`. But the card was already re-queued and the index advanced — the bad state is already committed. The user could navigate away before the error is even known.

**Fix:** At minimum, `gradeCard` should be made `async` and we should `await submitGrade` before re-queuing and advancing. For UI responsiveness, we could show a brief loading state per grade.

---

## Bug 6: Mouse Event Double-Fire on Button Clicks

**File:** [`StudyPage.tsx`](src/pages/StudyPage.tsx:70-72, 233-251)

The "Missed" and "Got it!" buttons sit **inside** the card div which has `onMouseDown`, `onMouseUp` handlers. When clicking a button:

1. `onMouseDown` fires → `setIsDragging(true)`, records `startXRef`
2. Button's `onClick` fires → calls `handleGrade('miss'/'got')` → `setIsDragging(false)`, `setDragX(0)`
3. `onMouseUp` fires → `onDragEnd()` → checks `isDragging` (now false, because `handleGrade` set it) → returns early

So this sequence is actually OK in the current code because `handleGrade` sets `isDragging = false` before the `onMouseUp` fires. The `onDragEnd` guard `if (!isDragging) return;` catches this. But on **touch** devices, both `touchend` AND `mouseup` fire, so if the `handleGrade` hasn't finished yet (it's synchronous in the state setter but React batches), the `onMouseUp` could fire `onDragEnd` with stale state. This is a timing edge case.

---

## Full Trace: Missed Card → Re-queue → Got It

Let's trace a **specific** card through the fixed system (after Bug 3 is also fixed):

### Card state from DB:
```
id: 42, japanese: "食べる", english: "to eat"
review_records: { interval: 7, ease_factor: 2.0, repetitions: 2, due_date: (today) }
```

### Step 1: Card appears (due today)
```js
card = { id: 42, interval: 7, easeFactor: 2.0, repetitions: 2, dueDate: (today) }
```

### Step 2: User taps "Missed"
```js
existing = { cardId: 42, interval: 7, easeFactor: 2.0, repetitions: 2, dueDate: today }
grade = 0  // QUALITY_MAP['miss'] = 0

// SM2 updateReview(existing, 0):
//   quality(0) < 2 → MISS path
//   repetitions = 0
//   interval = 1
//   easeFactor = max(2.0 - 0.15, 1.3) = 1.85
//   dueDate = now + 1 day

updated = { cardId: 42, interval: 1, easeFactor: 1.85, repetitions: 0, dueDate: tomorrow }
```

### Step 3: Fire-and-forget API call
```js
submitGrade({ cardId: 42, grade: 0, interval: 1, easeFactor: 1.85, repetitions: 0, dueDate: tomorrow })
// → POST /api/review → UPSERT review_records → INSERT session_logs
```

### Step 4: Re-queue (WITH FIX)
```js
// WITH FIX: use updated SM2 values
queueRef.current = [...queue, { ...card, interval: 1, easeFactor: 1.85, repetitions: 0, dueDate: tomorrow }]
// WITHOUT FIX: copies stale { interval: 7, easeFactor: 2.0, repetitions: 2 }
```

### Step 5: Card appears again (re-queued)
```js
// WITH FIX:
card = { id: 42, interval: 1, easeFactor: 1.85, repetitions: 0, dueDate: tomorrow }

// User taps "Got it"
existing = { cardId: 42, interval: 1, easeFactor: 1.85, repetitions: 0, dueDate: tomorrow }
grade = 2  // QUALITY_MAP['got'] = 2

// SM2 updateReview(existing, 2):
//   quality(2) >= 2 → GOT IT path
//   repetitions(0) < INTERVAL_STEPS.length(3) → interval = INTERVAL_STEPS[0] = 1
//   repetitions = 0 + 1 = 1
//   easeFactor unchanged = 1.85
//   dueDate = now + 1 day

updated = { cardId: 42, interval: 1, easeFactor: 1.85, repetitions: 1, dueDate: tomorrow }

// WITHOUT FIX:
// existing = { interval: 7, easeFactor: 2.0, repetitions: 2 }
// SM2: repetitions(2) < 3 → interval = INTERVAL_STEPS[2] = 7 (WRONG! Should be 1 after a miss)
```

---

## Action Items

| # | Bug | File | Priority | Status |
|---|-----|------|----------|--------|
| 1 | Multi-statement SQL | [`api/review.ts`](api/review.ts) | CRITICAL | ✅ Fixed |
| 2 | Missing migrations | [`api/review.ts`](api/review.ts), [`api/cards.ts`](api/cards.ts) | HIGH | ✅ Fixed |
| 3 | Re-queued card uses stale SM2 data | [`useSession.ts`](src/hooks/useSession.ts:142-148) | CRITICAL | ✅ Fixed |
| 4 | Fire-and-forget race condition | [`useSession.ts`](src/hooks/useSession.ts:117-134) | MEDIUM | ✅ Fixed |
| 5 | Potential mouse/touch double-fire | [`StudyPage.tsx`](src/pages/StudyPage.tsx:70-78) | LOW | Not addressed (edge case) |

### All critical algorithmic bugs are now resolved. The full flow works as:

1. User grades a card → SM2 calculates new interval/repetitions/easeFactor/dueDate
2. Grade is persisted to `review_records` (upsert) AND `session_logs` (insert) via two separate API calls
3. If missed: card is re-queued with **updated** SM2 values (not stale originals)
4. If got it: card advances normally through the interval steps
5. API call must succeed before advancing to next card (no more fire-and-forget)
6. On failure, the card stays on screen and error is shown