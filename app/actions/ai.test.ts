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
  const chainMethods = [
    "select",
    "eq",
    "gte",
    "lte",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
    "upsert",
  ] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.then = (resolve: (value: typeof result) => void) => resolve(result);
  return builder as unknown as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
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
        { data: { id: "txn-1" }, error: null }, // insert().select("id").single()
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
        { data: { id: "txn-1" }, error: null }, // insert().select("id").single()
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
          // resolveTransactionTarget now selects every column an edit needs,
          // so there's no separate "fetch existing" round trip afterwards.
          data: [
            {
              id: "txn-1",
              merchant: "Zomato",
              amount: 450_00,
              transaction_date: "2026-09-10",
              type: "expense",
              category_id: 1,
              payment_method: "UPI",
              account_info: null,
              notes: null,
            },
          ],
          error: null,
        },
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
    expect(builders.transactions[1].update).toHaveBeenCalledWith(
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

  it("skips the current cycle of a recurring expense without touching other fields", async () => {
    const { supabase, builders } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      recurring_expenses: [
        {
          // resolveRecurringTarget now selects every column an edit needs,
          // so there's no separate "fetch existing" round trip afterwards.
          data: [
            {
              id: "rec-1",
              name: "Netflix",
              amount: 649_00,
              frequency: "monthly",
              active: true,
              next_due_date: "2026-10-01",
              category_id: 2,
              payment_method: null,
              account_info: null,
            },
          ],
          error: null,
        },
        { data: { id: "rec-1" }, error: null }, // update
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({
        action: "edit_recurring_expense",
        target: { name: "Netflix" },
        changes: { skip: true },
      })
    );

    const result = await interpretMessage("skip netflix this month", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toContain("Skipped this cycle for Netflix");
      expect(result.text).toContain("Nov");
    }
    expect(builders.recurring_expenses[1].update).toHaveBeenCalledWith(
      expect.objectContaining({ next_due_date: "2026-11-01", amount: 649_00, name: "Netflix" })
    );
  });

  it("answers a category-filtered spending query", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        {
          data: [
            { amount: 300_00, type: "expense", category_id: 1, payment_method: "UPI" },
            { amount: 200_00, type: "expense", category_id: 2, payment_method: "Cash" },
          ],
          error: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({ action: "query_spending", category: "Food & Dining" })
    );

    const result = await interpretMessage("how much have I spent on food", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toContain("₹300.00");
      expect(result.text).toContain("Food & Dining");
    }
  });

  it("answers a savings query using the same math as the dashboard", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [
        { data: { currency: "INR" }, error: null }, // computeInterpretResult's own currency lookup
        { data: { monthly_salary: 50_000_00 }, error: null }, // the savings forecast's own salary lookup
      ],
      transactions: [
        { data: [{ amount: 10_000_00, type: "expense", category_id: 1, payment_method: "UPI" }], error: null },
      ],
      recurring_expenses: [{ data: [], error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(llmResponse({ action: "query_spending", metric: "savings" }));

    const result = await interpretMessage("how much have I saved this month", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toContain("₹40,000.00");
    }
  });

  it("gives a hard-no purchase verdict when the amount exceeds projected savings", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [
        { data: { currency: "INR" }, error: null },
        { data: { monthly_salary: 10_000_00 }, error: null },
      ],
      transactions: [
        { data: [{ amount: 8_000_00, type: "expense", category_id: 1, payment_method: "UPI" }], error: null },
      ],
      recurring_expenses: [{ data: [], error: null }],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({ action: "purchase_advice", amount: "5000", item: "earphones" })
    );

    const result = await interpretMessage("should I buy earphones for 5000", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toMatch(/hard no/i);
    }
  });

  it("pays a credit card bill once confirmed, and records the payment", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      transactions: [
        {
          data: [{ amount: 4_500_00, type: "expense", category_id: 1, payment_method: "HDFC Credit Card" }],
          error: null,
        },
      ],
      credit_card_payments: [
        { data: null, error: null }, // existing-payment check: none yet
        { error: null }, // the upsert
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({ action: "pay_credit_card_bill", cardName: "HDFC", confirmed: true })
    );

    const result = await interpretMessage("pay my hdfc card bill", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toMatch(/marked.*paid/i);
      expect(result.text).toContain("₹4,500.00");
    }
  });

  it("deletes a recurring expense once confirmed", async () => {
    const { supabase } = makeSupabase({
      categories: [{ data: categoriesRows, error: null }],
      profiles: [{ data: { currency: "INR" }, error: null }],
      recurring_expenses: [
        {
          data: [{ id: "rec-1", name: "Netflix", amount: 649_00, frequency: "monthly", active: true }],
          error: null,
        }, // resolveRecurringTarget
        { data: { id: "rec-1" }, error: null }, // deleteRecurringExpense's delete().select().maybeSingle()
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockCallOpenRouter.mockResolvedValue(
      llmResponse({ action: "delete_recurring_expense", target: { name: "Netflix" }, confirmed: true })
    );

    const result = await interpretMessage("yes delete netflix", null);

    expect(result.kind).toBe("confirmation");
    if (result.kind === "confirmation") {
      expect(result.text).toMatch(/deleted/i);
      expect(result.text).toContain("Netflix");
    }
  });
});
