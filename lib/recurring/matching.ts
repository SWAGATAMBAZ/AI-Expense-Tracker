import { advanceDueDate } from "./upcoming";
import type { RecurringFrequency } from "./validation";

export interface RecurringMatchCandidate {
  id: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  categoryId: number | null;
}

export interface TransactionForMatching {
  amountPaise: number;
  date: string;
  type: string;
  merchant: string | null;
  categoryId: number | null;
}

/**
 * How many days of slack around a due date still counts as "paid for that
 * occurrence". Must stay well under half the cycle length, or the windows
 * around two consecutive occurrences overlap and a late payment for one
 * cycle could be mistaken for an early payment of the next (most binding
 * for "weekly", whose 7-day cycle is short relative to any generous window).
 */
const WINDOW_DAYS: Record<RecurringFrequency, number> = {
  weekly: 2,
  monthly: 7,
  yearly: 14,
};

function parseUTC(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseUTC(a) - parseUTC(b)) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, days: number): string {
  const d = new Date(parseUTC(date) + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * The occurrence nearest to `transactionDate`, considering only the window
 * of slack that occurrence's frequency allows.
 *
 * `advanceDueDate` only ever rolls *forward* to the earliest occurrence at
 * or after its reference date - passing `transactionDate` directly would
 * overshoot to the *next* cycle for a late payment (the just-passed
 * occurrence is before transactionDate, so it fails the ">=" check and
 * gets skipped). Probing from `transactionDate - window` instead means a
 * late payment still finds the occurrence it's late *for* (which is still
 * >= the probe point, as long as the lateness is within the window),
 * while an early payment finds the same next occurrence it always would.
 */
function nearestOccurrence(candidate: RecurringMatchCandidate, transactionDate: string): string {
  const probe = addDays(transactionDate, -WINDOW_DAYS[candidate.frequency]);
  return advanceDueDate(candidate.nextDueDate, candidate.frequency, probe);
}

function isWithinWindow(candidate: RecurringMatchCandidate, transaction: TransactionForMatching): boolean {
  const occurrence = nearestOccurrence(candidate, transaction.date);
  return Math.abs(daysBetween(occurrence, transaction.date)) <= WINDOW_DAYS[candidate.frequency];
}

/**
 * How much an amount can differ and still count as "the same bill" - covers
 * small provider-side fee/tax drift between cycles without opening the door
 * to matching an unrelated transaction. Fixed floor keeps small bills exact
 * enough; the percentage keeps large bills from needing an unreasonably
 * tight fixed tolerance.
 */
function isWithinAmountTolerance(candidate: RecurringMatchCandidate, transaction: TransactionForMatching): boolean {
  const tolerance = Math.max(10_00, Math.round(candidate.amount * 0.01));
  return Math.abs(candidate.amount - transaction.amountPaise) <= tolerance;
}

function hasCorroboratingSignal(
  candidate: RecurringMatchCandidate,
  transaction: TransactionForMatching
): boolean {
  if (
    candidate.categoryId != null &&
    transaction.categoryId != null &&
    candidate.categoryId === transaction.categoryId
  ) {
    return true;
  }
  if (transaction.merchant) {
    const merchant = transaction.merchant.trim().toLowerCase();
    const name = candidate.name.trim().toLowerCase();
    if (merchant && name && (merchant.includes(name) || name.includes(merchant))) return true;
  }
  return false;
}

/**
 * Finds the single recurring expense a new expense transaction confidently
 * settles (PRD §7), or null if there's no match or more than one plausible
 * candidate - never guess between ambiguous matches.
 */
export function findMatchingRecurringExpense(
  candidates: RecurringMatchCandidate[],
  transaction: TransactionForMatching
): RecurringMatchCandidate | null {
  if (transaction.type !== "expense") return null;

  const matches = candidates.filter(
    (candidate) =>
      isWithinAmountTolerance(candidate, transaction) &&
      isWithinWindow(candidate, transaction) &&
      hasCorroboratingSignal(candidate, transaction)
  );

  return matches.length === 1 ? matches[0] : null;
}

/**
 * The next_due_date to persist once `candidate` is confidently fulfilled by
 * a transaction dated `transactionDate` - always progresses at least one
 * full cycle past the occurrence just settled, whether that occurrence was
 * still in the future (paid early) or long past (stale/overdue).
 */
export function advancePastMatch(
  candidate: RecurringMatchCandidate,
  transactionDate: string
): string {
  const occurrence = nearestOccurrence(candidate, transactionDate);
  const dayAfterOccurrence = addDays(occurrence, 1);
  return advanceDueDate(candidate.nextDueDate, candidate.frequency, dayAfterOccurrence);
}
