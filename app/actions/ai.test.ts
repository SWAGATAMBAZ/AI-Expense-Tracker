import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

const mockCallOpenRouter = vi.fn();
vi.mock("@/lib/ai/openrouter", () => ({
  callOpenRouter: (...args: unknown[]) => mockCallOpenRouter(...args),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

import { interpretMessage } from "./ai";

const categoriesRows = [
  { id: 1, name: "Food & Dining" },
  { id: 2, name: "Groceries" },
];

/** A chainable, thenable query-builder stub that always resolves to `result`. */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const chainMethods = ["select", "eq", "order", "limit", "insert", "update", "delete"] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: typeof result) => void) => resolve(result);
  return builder as unknown as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

type QueueMap = Record<string, Array<{ data?: unknown; error?: unknown }>>;

/** Builds a fake Supabase client that serves queued results per table, in call order. */
function makeSupabase(queues: QueueMap, authenticated = true) {
  const counters: Record<string, number> = {};
  const builders: Record<string, ReturnType<typeof makeBuilder>[]> = {};

  const from = vi.fn((table: string) => {
    const queue = queues[table] ?? [];
    const i = counters[table] ?? 0;
    counters[table] = i + 1;
    const result = queue[i] ?? { data: null, error: null };
    const builder = makeBuilder(result);
    builders[table] = builders[table] ?? [];
    builders[table].push(builder);
    return builder;
  });

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authenticated ? { id: "user-1" } : null },
      })),
    },
    from,
  };

  return { supabase, builders };
}

function llmResponse(intent: unknown) {
  return { ok: true, content: JSON.stringify(intent) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("interpretMessage", () => {
  it("returns an error without calling the LLM when the user isn't authenticated", async () => {
    const { supabase } = makeSupabase({}, false);
    mockCreateClient.mockResolvedValue(supabase);

    const result = await interpretMessage("spent 500 on lunch", null);

    expect(result).toEqual({ kind: "error", text: "Your session expired. Please log in again." });
    expect(mockCallOpenRouter).not.toHaveBeenCalled();
  });

  it("tells the user the assistant is unavailable when the LLM call fails", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue({ ok: false, error: "down" });

    const result = await interpretMessage("spent 500 on lunch", null);

    expect(result.kind).toBe("error");
  });

  it("asks the user to rephrase when the model returns unparsable JSON", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue({ ok: true, content: "not json" });

    const result = await interpretMessage("asdkjasd", null);

    expect(result.kind).toBe("clarify");
  });

  it("adds a clean transaction and returns a confirmation", async () => {
    const { supabase, builders } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        { data: [], error: null }, // duplicate check: no match
        { error: null }, // insert
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({
        action: "add_transaction",
        merchant: "Zomato",
        amount: "500",
        category: "Food & Dining",
        date: "2026-09-14",
        paymentMethod: "UPI",
        type: "expense",
      })
    );

    const result = await interpretMessage("spent 500 on zomato via upi", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toContain("500");
      expect(result.text).toContain("Zomato");
      expect(result.text).toContain("Food & Dining");
    }
    expect(builders.transactions[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500_00, merchant: "Zomato", type: "expense", source: "llm" })
    );
  });

  it("mentions settling a recurring expense in the confirmation when one matches", async () => {
    const { supabase, builders } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        { data: [], error: null }, // duplicate check: no match
        { error: null }, // insert
      ],
      recurring_expenses: [
        {
          data: [
            {
              id: "rec-1",
              name: "Netflix",
              amount: 500_00,
              frequency: "monthly",
              next_due_date: "2026-09-16",
              category_id: 1,
            },
          ],
          error: null,
        }, // candidate fetch
        { error: null }, // advance the match
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({
        action: "add_transaction",
        merchant: "Netflix",
        amount: "500",
        category: "Food & Dining",
        date: "2026-09-14",
        type: "expense",
      })
    );

    const result = await interpretMessage("spent 500 on netflix", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toContain("This settles your upcoming Netflix payment.");
    }
    expect(builders.transactions[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ matched_recurring_expense_id: "rec-1" })
    );
    expect(builders.recurring_expenses[1].update).toHaveBeenCalled();
  });

  it("asks for the amount when it's missing, without touching the database", async () => {
    const { supabase, builders } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(llmResponse({ action: "add_transaction", merchant: "Zomato" }));

    const result = await interpretMessage("spent something at zomato", null);

    expect(result.kind).toBe("clarify");
    if (result.kind === "clarify") {
      expect(result.pending?.missingFields).toContain("amount");
    }
    expect(builders.transactions).toBeUndefined();
  });

  it("skips inserting and reports a duplicate instead", async () => {
    const { supabase, builders } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        {
          data: [{ id: "txn-9", merchant: "Zomato", amount: 500_00, transaction_date: "2026-09-14" }],
          error: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({
        action: "add_transaction",
        merchant: "Zomato",
        amount: "500",
        date: "2026-09-14",
        type: "expense",
      })
    );

    const result = await interpretMessage("spent 500 on zomato", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text.toLowerCase()).toContain("duplicate");
    }
    expect(builders.transactions).toHaveLength(1); // only the duplicate check, no insert
  });

  it("resolves a single edit target and merges changes with the existing row", async () => {
    const { supabase, builders } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        {
          data: [
            { id: "txn-1", merchant: "Zomato", amount: 450_00, transaction_date: "2026-09-10", type: "expense" },
          ],
          error: null,
        }, // resolveTransactionTarget
        {
          data: {
            merchant: "Zomato",
            amount: 450_00,
            category_id: 1,
            transaction_date: "2026-09-10",
            payment_method: "UPI",
            account_info: null,
            type: "expense",
            notes: null,
          },
          error: null,
        }, // fetch existing
        { data: { id: "txn-1" }, error: null }, // update
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({
        action: "edit_transaction",
        target: { merchant: "Zomato" },
        changes: { amount: "500" },
      })
    );

    const result = await interpretMessage("actually that zomato one was 500 not 450", null);

    expect(result.kind).toBe("confirmation");
    expect(builders.transactions[2].update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500_00, merchant: "Zomato", payment_method: "UPI" })
    );
  });

  it("asks which one when an edit target matches multiple rows", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        {
          data: [
            { id: "t1", merchant: "Zomato", amount: 500_00, transaction_date: "2026-09-14", type: "expense" },
            { id: "t3", merchant: "Zomato Gold", amount: 200_00, transaction_date: "2026-09-05", type: "expense" },
          ],
          error: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({ action: "edit_transaction", target: { merchant: "Zomato" }, changes: { amount: "500" } })
    );

    const result = await interpretMessage("update the zomato one to 500", null);

    expect(result.kind).toBe("clarify");
    if (result.kind === "clarify") {
      expect(result.text).toContain("Zomato Gold");
      expect(result.pending?.missingFields).toContain("target");
    }
  });

  it("asks for confirmation before deleting, then deletes once confirmed", async () => {
    const matchedRow = {
      id: "txn-1",
      merchant: "Zomato",
      amount: 500_00,
      transaction_date: "2026-09-14",
      type: "expense",
    };

    // Turn 1: no confirmation yet.
    const first = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [{ data: [matchedRow], error: null }],
    });
    mockCreateClient.mockResolvedValueOnce(first.supabase);
    mockCallOpenRouter.mockResolvedValueOnce(
      llmResponse({ action: "delete_transaction", target: { merchant: "Zomato" } })
    );

    const firstResult = await interpretMessage("delete the zomato transaction", null);
    expect(firstResult.kind).toBe("clarify");
    if (firstResult.kind !== "clarify") throw new Error("expected clarify");
    expect(firstResult.text).toContain("Reply yes to confirm");

    // Turn 2: user confirms.
    const second = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        { data: [matchedRow], error: null }, // resolve again
        { data: { id: "txn-1" }, error: null }, // deleteTransaction's delete().select().maybeSingle()
      ],
    });
    // `deleteTransaction` (reused from app/actions/transactions.ts) creates its
    // own Supabase client internally, so it consumes a second resolution here.
    mockCreateClient.mockResolvedValueOnce(second.supabase).mockResolvedValueOnce(second.supabase);
    mockCallOpenRouter.mockResolvedValueOnce(
      llmResponse({ action: "delete_transaction", target: { merchant: "Zomato" }, confirmed: true })
    );

    const secondResult = await interpretMessage("yes", firstResult.pending);
    expect(secondResult.kind).toBe("confirmation");
    if (secondResult.kind === "confirmation") {
      expect(secondResult.text.toLowerCase()).toContain("deleted");
    }
    expect(second.builders.transactions[1].delete).toHaveBeenCalled();
  });
});
