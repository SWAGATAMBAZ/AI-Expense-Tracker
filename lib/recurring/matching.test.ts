import { describe, expect, it } from "vitest";
import { findMatchingRecurringExpense, advancePastMatch, type RecurringMatchCandidate } from "./matching";

const rent: RecurringMatchCandidate = {
  id: "rec-rent",
  name: "Rent",
  amount: 20_000_00,
  frequency: "monthly",
  nextDueDate: "2026-09-28",
  categoryId: 9,
};

const netflix: RecurringMatchCandidate = {
  id: "rec-netflix",
  name: "Netflix",
  amount: 649_00,
  frequency: "monthly",
  nextDueDate: "2026-10-01",
  categoryId: 14,
};

const gymWeekly: RecurringMatchCandidate = {
  id: "rec-gym",
  name: "Gym",
  amount: 1_500_00,
  frequency: "weekly",
  nextDueDate: "2026-09-15",
  categoryId: 13,
};

describe("findMatchingRecurringExpense", () => {
  it("matches on amount + date window + same category", () => {
    const result = findMatchingRecurringExpense([rent, netflix], {
      amountPaise: 20_000_00,
      date: "2026-09-27",
      type: "expense",
      merchant: "Landlord",
      categoryId: 9,
    });
    expect(result?.id).toBe("rec-rent");
  });

  it("matches on amount + date window + merchant-name substring, without a category signal", () => {
    const result = findMatchingRecurringExpense([netflix], {
      amountPaise: 649_00,
      date: "2026-10-02",
      type: "expense",
      merchant: "NETFLIX.COM",
      categoryId: null,
    });
    expect(result?.id).toBe("rec-netflix");
  });

  it("does not match when the amount differs", () => {
    const result = findMatchingRecurringExpense([rent], {
      amountPaise: 20_500_00,
      date: "2026-09-28",
      type: "expense",
      merchant: "Landlord",
      categoryId: 9,
    });
    expect(result).toBeNull();
  });

  it("does not match without any corroborating signal", () => {
    const result = findMatchingRecurringExpense([rent], {
      amountPaise: 20_000_00,
      date: "2026-09-28",
      type: "expense",
      merchant: "Random Store",
      categoryId: null,
    });
    expect(result).toBeNull();
  });

  it("does not guess when two candidates both plausibly match", () => {
    const rentTwin: RecurringMatchCandidate = { ...rent, id: "rec-rent-2" };
    const result = findMatchingRecurringExpense([rent, rentTwin], {
      amountPaise: 20_000_00,
      date: "2026-09-28",
      type: "expense",
      merchant: "Landlord",
      categoryId: 9,
    });
    expect(result).toBeNull();
  });

  it("never matches a non-expense transaction", () => {
    const result = findMatchingRecurringExpense([rent], {
      amountPaise: 20_000_00,
      date: "2026-09-28",
      type: "income",
      merchant: "Landlord",
      categoryId: 9,
    });
    expect(result).toBeNull();
  });

  it("respects each frequency's window boundary", () => {
    // Weekly: due 2026-09-15, window is +/-2 days (kept tight relative to
    // the 7-day cycle so a late payment for one week can't be mistaken for
    // an early payment of the next).
    const justInside = findMatchingRecurringExpense([gymWeekly], {
      amountPaise: 1_500_00,
      date: "2026-09-17",
      type: "expense",
      merchant: "Gym",
      categoryId: 13,
    });
    expect(justInside?.id).toBe("rec-gym");

    const justOutside = findMatchingRecurringExpense([gymWeekly], {
      amountPaise: 1_500_00,
      date: "2026-09-18",
      type: "expense",
      merchant: "Gym",
      categoryId: 13,
    });
    expect(justOutside).toBeNull();
  });

  it("does not let a late payment for one weekly cycle bleed into the next cycle's window", () => {
    // Due 2026-09-15 and 2026-09-22 (next cycle). A payment right in the
    // middle (2026-09-18/19) must match neither, per the tightened window.
    const middle = findMatchingRecurringExpense([gymWeekly], {
      amountPaise: 1_500_00,
      date: "2026-09-19",
      type: "expense",
      merchant: "Gym",
      categoryId: 13,
    });
    expect(middle).toBeNull();
  });
});

describe("advancePastMatch", () => {
  it("advances by exactly one cycle when paid before the due date", () => {
    // Rent due 2026-09-28, paid early on 2026-09-24.
    expect(advancePastMatch(rent, "2026-09-24")).toBe("2026-10-28");
  });

  it("advances by exactly one cycle when paid on the due date", () => {
    expect(advancePastMatch(rent, "2026-09-28")).toBe("2026-10-28");
  });

  it("advances to the next future cycle when the recurring expense was stale/overdue", () => {
    // Rent's stored due date is 3 months behind; paid today.
    const stale: RecurringMatchCandidate = { ...rent, nextDueDate: "2026-06-28" };
    expect(advancePastMatch(stale, "2026-09-25")).toBe("2026-10-28");
  });
});
