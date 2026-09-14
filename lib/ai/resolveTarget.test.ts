import { describe, expect, it, vi } from "vitest";
import { resolveTransactionTarget, resolveRecurringTarget } from "./resolveTarget";

function makeSupabase(result: { data: unknown; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => builder),
    })),
  } as never;
}

const rows = [
  { id: "t1", merchant: "Zomato", amount: 500_00, transaction_date: "2026-09-14", type: "expense" },
  { id: "t2", merchant: "Swiggy", amount: 380_00, transaction_date: "2026-09-10", type: "expense" },
  { id: "t3", merchant: "Zomato Gold", amount: 200_00, transaction_date: "2026-09-05", type: "expense" },
];

describe("resolveTransactionTarget", () => {
  it("resolves to the newest row when mostRecent is set with no other hints", async () => {
    const supabase = makeSupabase({ data: rows, error: null });
    const result = await resolveTransactionTarget(supabase, "user-1", { mostRecent: true });
    expect(result).toEqual({ status: "resolved", row: rows[0] });
  });

  it("returns none when there are no hints at all", async () => {
    const supabase = makeSupabase({ data: rows, error: null });
    const result = await resolveTransactionTarget(supabase, "user-1", {});
    expect(result).toEqual({ status: "none" });
  });

  it("narrows by merchant substring to a single match", async () => {
    const supabase = makeSupabase({ data: rows, error: null });
    const result = await resolveTransactionTarget(supabase, "user-1", { merchant: "Swiggy" });
    expect(result).toEqual({ status: "resolved", row: rows[1] });
  });

  it("returns multiple candidates when a merchant hint matches more than one row", async () => {
    const supabase = makeSupabase({ data: rows, error: null });
    const result = await resolveTransactionTarget(supabase, "user-1", { merchant: "Zomato" });
    expect(result.status).toBe("multiple");
    if (result.status === "multiple") {
      expect(result.candidates.map((c) => c.id)).toEqual(["t1", "t3"]);
    }
  });

  it("converts a rupee amount hint to paise before matching", async () => {
    const supabase = makeSupabase({ data: rows, error: null });
    const result = await resolveTransactionTarget(supabase, "user-1", { amount: "380" });
    expect(result).toEqual({ status: "resolved", row: rows[1] });
  });

  it("returns none when a hint matches nothing", async () => {
    const supabase = makeSupabase({ data: rows, error: null });
    const result = await resolveTransactionTarget(supabase, "user-1", { merchant: "Dominos" });
    expect(result).toEqual({ status: "none" });
  });

  it("returns none (not throws) on a supabase error", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "boom" } });
    const result = await resolveTransactionTarget(supabase, "user-1", { mostRecent: true });
    expect(result).toEqual({ status: "none" });
  });
});

describe("resolveRecurringTarget", () => {
  const recurringRows = [
    { id: "r1", name: "Netflix", amount: 649_00, frequency: "monthly", active: true },
    { id: "r2", name: "Gym membership", amount: 1_500_00, frequency: "monthly", active: true },
  ];

  it("resolves by name substring", async () => {
    const supabase = makeSupabase({ data: recurringRows, error: null });
    const result = await resolveRecurringTarget(supabase, "user-1", { name: "netflix" });
    expect(result).toEqual({ status: "resolved", row: recurringRows[0] });
  });

  it("returns none with no hints and no mostRecent", async () => {
    const supabase = makeSupabase({ data: recurringRows, error: null });
    const result = await resolveRecurringTarget(supabase, "user-1", {});
    expect(result).toEqual({ status: "none" });
  });

  it("resolves to the newest row when mostRecent is set", async () => {
    const supabase = makeSupabase({ data: recurringRows, error: null });
    const result = await resolveRecurringTarget(supabase, "user-1", { mostRecent: true });
    expect(result).toEqual({ status: "resolved", row: recurringRows[0] });
  });
});
