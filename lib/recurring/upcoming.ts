import type { RecurringFrequency } from "./validation";

interface DateParts {
  year: number;
  month: number; // 0-indexed
  day: number;
}

function parseDate(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function formatDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Rolls a due date forward by whole cycles of `frequency` until it is
 * `>= referenceToday`. Re-derives each candidate from the *original*
 * day-of-month rather than mutating a running date, so a monthly bill due
 * the 31st rolls Jan 31 -> Feb 28/29 -> Mar 31, not Jan 31 -> Feb 28 -> Mar 28.
 */
export function advanceDueDate(
  date: string,
  frequency: RecurringFrequency,
  referenceToday: string
): string {
  if (date >= referenceToday) return date;

  const { year, month, day } = parseDate(date);

  if (frequency === "weekly") {
    const start = Date.UTC(year, month, day);
    const ref = parseDate(referenceToday);
    const today = Date.UTC(ref.year, ref.month, ref.day);
    const diffDays = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
    const cycles = Math.ceil(diffDays / 7);
    const next = new Date(start + cycles * 7 * 24 * 60 * 60 * 1000);
    return formatDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  }

  if (frequency === "monthly") {
    let cycleCount = 0;
    while (true) {
      const totalMonths = month + cycleCount;
      const candidateYear = year + Math.floor(totalMonths / 12);
      const candidateMonth = totalMonths % 12;
      const candidateDay = Math.min(day, daysInMonth(candidateYear, candidateMonth));
      const candidate = formatDate(candidateYear, candidateMonth, candidateDay);
      if (candidate >= referenceToday) return candidate;
      cycleCount++;
    }
  }

  // yearly
  let cycleCount = 0;
  while (true) {
    const candidateYear = year + cycleCount;
    const candidateDay = Math.min(day, daysInMonth(candidateYear, month));
    const candidate = formatDate(candidateYear, month, candidateDay);
    if (candidate >= referenceToday) return candidate;
    cycleCount++;
  }
}

export interface RecurringExpenseInput {
  id: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  active: boolean;
}

export interface UpcomingItem {
  id: string;
  name: string;
  amount: number;
  nextOccurrence: string;
}

export interface UpcomingSpend {
  items: UpcomingItem[];
  total: number;
}

/** Derives each active recurring expense's next occurrence + amount, sorted soonest first. */
export function getUpcomingSpend(
  recurringExpenses: RecurringExpenseInput[],
  referenceToday: string
): UpcomingSpend {
  const items = recurringExpenses
    .filter((expense) => expense.active)
    .map((expense) => ({
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      nextOccurrence: advanceDueDate(expense.nextDueDate, expense.frequency, referenceToday),
    }))
    .sort((a, b) => a.nextOccurrence.localeCompare(b.nextOccurrence));

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { items, total };
}
