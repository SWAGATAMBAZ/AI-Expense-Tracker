export const DATE_RANGE_FILTERS = [
  "today",
  "week",
  "month",
  "last_month",
  "previous_months",
  "custom",
] as const;
export type DateRangeFilter = (typeof DATE_RANGE_FILTERS)[number];

export interface ResolvedDateRange {
  start: string;
  end: string;
  label: string;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
  /** yyyy-mm, used by the "previous_months" filter. */
  month?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function parseISODate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Resolves one of the 6 PRD date-range filters into concrete [start, end] bounds (inclusive). */
export function resolveDateRange(
  filter: DateRangeFilter,
  params: DateRangeParams,
  referenceToday: string
): ResolvedDateRange {
  const { year, month, day } = parseISODate(referenceToday);

  switch (filter) {
    case "today":
      return { start: referenceToday, end: referenceToday, label: "Today" };

    case "week": {
      // Monday-start week-to-date (spend can't be in the future anyway).
      const todayUTC = new Date(Date.UTC(year, month, day));
      const dayOfWeek = todayUTC.getUTCDay(); // 0 = Sunday
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(todayUTC);
      monday.setUTCDate(monday.getUTCDate() - diffToMonday);
      const start = toISODate(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
      return { start, end: referenceToday, label: "This Week" };
    }

    case "month": {
      const start = toISODate(year, month, 1);
      const end = toISODate(year, month, lastDayOfMonth(year, month));
      return { start, end, label: "This Month" };
    }

    case "last_month": {
      const lastMonthIndex = month === 0 ? 11 : month - 1;
      const lastMonthYear = month === 0 ? year - 1 : year;
      const start = toISODate(lastMonthYear, lastMonthIndex, 1);
      const end = toISODate(lastMonthYear, lastMonthIndex, lastDayOfMonth(lastMonthYear, lastMonthIndex));
      return { start, end, label: "Last Month" };
    }

    case "previous_months": {
      let targetYear: number;
      let targetMonth: number;
      if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
        const [y, m] = params.month.split("-").map(Number);
        targetYear = y;
        targetMonth = m - 1;
      } else {
        // Default to the month before last, since "Last Month" already covers the immediately-prior one.
        const offset = month < 2 ? month - 2 + 12 : month - 2;
        targetYear = month < 2 ? year - 1 : year;
        targetMonth = offset;
      }
      const start = toISODate(targetYear, targetMonth, 1);
      const end = toISODate(targetYear, targetMonth, lastDayOfMonth(targetYear, targetMonth));
      return { start, end, label: `${MONTH_LABELS[targetMonth]} ${targetYear}` };
    }

    case "custom": {
      const start = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : referenceToday;
      const end = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : referenceToday;
      return start <= end
        ? { start, end, label: "Custom Range" }
        : { start: end, end: start, label: "Custom Range" };
    }

    default:
      return resolveDateRange("month", params, referenceToday);
  }
}
