export function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

/** Formats a yyyy-mm-dd date string for display, parsed as UTC to avoid timezone drift. */
export function formatShortDate(date: string, options?: { includeYear?: boolean }) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(options?.includeYear !== false ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
