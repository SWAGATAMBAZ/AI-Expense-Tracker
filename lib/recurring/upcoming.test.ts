import { describe, expect, it } from "vitest";
import { advanceDueDate, getUpcomingSpend } from "./upcoming";

describe("advanceDueDate", () => {
  it("returns the same date when it's today or in the future", () => {
    expect(advanceDueDate("2026-03-15", "monthly", "2026-03-01")).toBe("2026-03-15");
    expect(advanceDueDate("2026-03-01", "monthly", "2026-03-01")).toBe("2026-03-01");
  });

  it("rolls a weekly expense forward by whole weeks", () => {
    // Due 2026-01-01 (Thursday), checked 2026-01-20 -> next occurrence should be >= today, 7-day cadence
    const result = advanceDueDate("2026-01-01", "weekly", "2026-01-20");
    expect(result >= "2026-01-20").toBe(true);
    // Should land on a date exactly N*7 days after 2026-01-01
    const start = Date.UTC(2026, 0, 1);
    const [y, m, d] = result.split("-").map(Number);
    const landed = Date.UTC(y, m - 1, d);
    expect((landed - start) % (7 * 24 * 60 * 60 * 1000)).toBe(0);
  });

  it("rolls a monthly expense due Jan 31 through Feb (28/29) to Mar 31, not Mar 28", () => {
    expect(advanceDueDate("2026-01-31", "monthly", "2026-02-15")).toBe("2026-02-28"); // 2026 not a leap year
    expect(advanceDueDate("2026-01-31", "monthly", "2026-03-15")).toBe("2026-03-31");
  });

  it("rolls a monthly expense due Jan 31 to Feb 29 in a leap year", () => {
    expect(advanceDueDate("2028-01-31", "monthly", "2028-02-15")).toBe("2028-02-29"); // 2028 is a leap year
  });

  it("rolls a monthly expense across a year boundary", () => {
    expect(advanceDueDate("2025-12-05", "monthly", "2025-12-10")).toBe("2026-01-05");
  });

  it("rolls a yearly expense forward by whole years, clamping Feb 29 in a non-leap year", () => {
    expect(advanceDueDate("2028-02-29", "yearly", "2029-01-01")).toBe("2029-02-28");
    // 2032 is the next leap year after 2028 - checked before that date arrives, so it lands there unclamped.
    expect(advanceDueDate("2028-02-29", "yearly", "2032-01-01")).toBe("2032-02-29");
  });

  it("handles a due date many years in the past without excessive iteration (closed-form jump)", () => {
    expect(advanceDueDate("2000-01-15", "monthly", "2026-06-01")).toBe("2026-06-15");
    expect(advanceDueDate("2000-01-15", "yearly", "2026-06-01")).toBe("2027-01-15");
  });
});

describe("getUpcomingSpend", () => {
  const base = {
    id: "1",
    name: "Rent",
    amount: 20_000_00,
    frequency: "monthly" as const,
    nextDueDate: "2026-01-01",
    active: true,
  };

  it("excludes inactive expenses from items and total", () => {
    const result = getUpcomingSpend(
      [base, { ...base, id: "2", name: "Old gym", active: false, amount: 1_500_00 }],
      "2026-01-15"
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("1");
    expect(result.total).toBe(20_000_00);
  });

  it("sorts items by soonest next occurrence", () => {
    const result = getUpcomingSpend(
      [
        { ...base, id: "1", name: "Rent", nextDueDate: "2026-01-20" },
        { ...base, id: "2", name: "Netflix", nextDueDate: "2026-01-05", amount: 649_00 },
      ],
      "2026-01-01"
    );
    expect(result.items.map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("sums the total across all active items", () => {
    const result = getUpcomingSpend(
      [
        { ...base, id: "1", amount: 20_000_00 },
        { ...base, id: "2", amount: 1_500_00 },
      ],
      "2026-01-01"
    );
    expect(result.total).toBe(21_500_00);
  });

  it("returns an empty result for no active expenses", () => {
    expect(getUpcomingSpend([], "2026-01-01")).toEqual({ items: [], total: 0 });
  });
});
