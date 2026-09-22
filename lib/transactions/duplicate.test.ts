import { describe, expect, it, vi } from "vitest";
import { findDuplicateTransaction } from "./duplicate";

function makeSupabase(result: { data: unknown; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => builder),
    })),
  } as never;
}

describe("findDuplicateTransaction", () => {
  it("returns the matching row when merchant matches case-insensitively", async () => {
    const supabase = makeSupabase({
      data: [{ id: "txn-1", merchant: "Zomato", amount: 500_00, transaction_date: "2026-09-14" }],
      error: null,
    });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: "zomato",
    });

    expect(result).toEqual({
      id: "txn-1",
      merchant: "Zomato",
      amount: 500_00,
      transaction_date: "2026-09-14",
    });
  });

  it("returns null when no row shares the same date+amount+type", async () => {
    const supabase = makeSupabase({ data: [], error: null });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: "Zomato",
    });

    expect(result).toBeNull();
  });

  it("returns null when the merchant doesn't match any same-day/amount/type row", async () => {
    const supabase = makeSupabase({
      data: [{ id: "txn-1", merchant: "Swiggy", amount: 500_00, transaction_date: "2026-09-14" }],
      error: null,
    });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: "Zomato",
    });

    expect(result).toBeNull();
  });

  it("matches on date+amount+type alone when the candidate has no merchant and exactly one merchant-less row exists", async () => {
    const supabase = makeSupabase({
      data: [{ id: "txn-1", merchant: null, amount: 500_00, transaction_date: "2026-09-14" }],
      error: null,
    });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: null,
    });

    expect(result?.id).toBe("txn-1");
  });

  it("does not flag a merchant-less candidate against an existing row that has a merchant", async () => {
    // Same date+amount+type, but the only existing row has a real merchant -
    // this is likely a distinct transaction, not a re-submission of it.
    const supabase = makeSupabase({
      data: [{ id: "txn-1", merchant: "Zomato", amount: 500_00, transaction_date: "2026-09-14" }],
      error: null,
    });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: null,
    });

    expect(result).toBeNull();
  });

  it("does not guess between multiple merchant-less candidates", async () => {
    // Two distinct merchant-less transactions (e.g. two cash purchases) can
    // legitimately share date+amount+type - picking one would risk silently
    // dropping a real transaction.
    const supabase = makeSupabase({
      data: [
        { id: "txn-1", merchant: null, amount: 500_00, transaction_date: "2026-09-14" },
        { id: "txn-2", merchant: null, amount: 500_00, transaction_date: "2026-09-14" },
      ],
      error: null,
    });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: null,
    });

    expect(result).toBeNull();
  });

  it("returns null (not throws) on a supabase error", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "boom" } });

    const result = await findDuplicateTransaction(supabase, "user-1", {
      amountPaise: 500_00,
      date: "2026-09-14",
      type: "expense",
      merchant: null,
    });

    expect(result).toBeNull();
  });
});
