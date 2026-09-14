import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const mockRevalidatePath = vi.fn();
const mockUnstableRethrow = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
  unstable_rethrow: (error: unknown) => mockUnstableRethrow(error),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

const categoriesRows = [
  { id: 1, name: "Food & Dining" },
  { id: 2, name: "Groceries" },
];

function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.insert = vi.fn(async () => result);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve: (value: typeof result) => void) => resolve(result);
  return builder;
}

let fromImpl: (table: string) => unknown;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => fromImpl(table)),
  })),
}));

import { createTransaction, updateTransaction, deleteTransaction } from "./transactions";

const validFormData = () => {
  const fd = new FormData();
  fd.set("merchant", "Zomato");
  fd.set("amount", "500");
  fd.set("categoryId", "1");
  fd.set("date", "2026-01-01");
  fd.set("paymentMethod", "UPI");
  fd.set("accountInfo", "HDFC XXXX1234");
  fd.set("type", "expense");
  fd.set("notes", "");
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("createTransaction", () => {
  it("returns field errors without hitting the database when validation fails", async () => {
    fromImpl = () => makeQueryBuilder({ data: categoriesRows });
    const fd = validFormData();
    fd.set("amount", "-1");

    const result = await createTransaction({}, fd);
    expect(result.fieldErrors).toBeDefined();
    expect(result.fieldErrors?.amount).toBeTruthy();
  });

  it("inserts the transaction and redirects on success", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "profiles") return makeQueryBuilder({ data: { currency: "INR" } });
      if (table === "recurring_expenses") return makeQueryBuilder({ data: [] });
      if (table === "transactions") return makeQueryBuilder({ error: null });
      throw new Error(`unexpected table ${table}`);
    };

    await expect(createTransaction({}, validFormData())).rejects.toThrow("REDIRECT:/transactions");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recurring");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
  });

  it("still inserts and redirects with a warning flag when a duplicate exists", async () => {
    let transactionsInsertBuilder: ReturnType<typeof makeQueryBuilder> | undefined;
    let transactionsCallCount = 0;

    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "profiles") return makeQueryBuilder({ data: { currency: "INR" } });
      if (table === "recurring_expenses") return makeQueryBuilder({ data: [] });
      if (table === "transactions") {
        transactionsCallCount++;
        if (transactionsCallCount === 1) {
          // findDuplicateTransaction's select().eq()... chain.
          return makeQueryBuilder({
            data: [{ id: "txn-existing", merchant: "Zomato", amount: 500_00, transaction_date: "2026-01-01" }],
          });
        }
        transactionsInsertBuilder = makeQueryBuilder({ error: null });
        return transactionsInsertBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    };

    await expect(createTransaction({}, validFormData())).rejects.toThrow(
      "REDIRECT:/transactions?duplicateWarning=1"
    );
    expect(transactionsInsertBuilder!.insert).toHaveBeenCalled();
  });

  it("returns a generic error when the insert fails", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "profiles") return makeQueryBuilder({ data: { currency: "INR" } });
      if (table === "recurring_expenses") return makeQueryBuilder({ data: [] });
      if (table === "transactions") return makeQueryBuilder({ error: { message: "boom" } });
      throw new Error(`unexpected table ${table}`);
    };

    const result = await createTransaction({}, validFormData());
    expect(result.error).toBe("Could not save this transaction. Please try again.");
  });

  it("returns a session error when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    fromImpl = () => makeQueryBuilder({ data: categoriesRows });

    const result = await createTransaction({}, validFormData());
    expect(result.error).toBe("Your session expired. Please log in again.");
  });

  it("records a matched recurring expense and advances its next due date", async () => {
    // validFormData: amount 500, categoryId 1, date 2026-01-01, type expense.
    let transactionsInsertBuilder: ReturnType<typeof makeQueryBuilder> | undefined;
    let recurringUpdateBuilder: ReturnType<typeof makeQueryBuilder> | undefined;
    let recurringCallCount = 0;

    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "profiles") return makeQueryBuilder({ data: { currency: "INR" } });
      if (table === "recurring_expenses") {
        recurringCallCount++;
        if (recurringCallCount === 1) {
          return makeQueryBuilder({
            data: [
              {
                id: "rec-1",
                name: "Zomato Gold",
                amount: 500_00,
                frequency: "monthly",
                next_due_date: "2026-01-03",
                category_id: 1,
              },
            ],
          });
        }
        recurringUpdateBuilder = makeQueryBuilder({ error: null });
        return recurringUpdateBuilder;
      }
      if (table === "transactions") {
        transactionsInsertBuilder = makeQueryBuilder({ error: null });
        return transactionsInsertBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    };

    await expect(createTransaction({}, validFormData())).rejects.toThrow("REDIRECT:/transactions");

    expect(transactionsInsertBuilder!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ matched_recurring_expense_id: "rec-1" })
    );
    expect(recurringUpdateBuilder!.update).toHaveBeenCalledWith(
      expect.objectContaining({ next_due_date: "2026-02-03" })
    );
  });

  it("does not touch any recurring expense when nothing matches", async () => {
    let transactionsInsertBuilder: ReturnType<typeof makeQueryBuilder> | undefined;
    let recurringCallCount = 0;

    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "profiles") return makeQueryBuilder({ data: { currency: "INR" } });
      if (table === "recurring_expenses") {
        recurringCallCount++;
        return makeQueryBuilder({
          data: [
            {
              id: "rec-1",
              name: "Rent",
              amount: 20_000_00,
              frequency: "monthly",
              next_due_date: "2026-01-28",
              category_id: 9,
            },
          ],
        });
      }
      if (table === "transactions") {
        transactionsInsertBuilder = makeQueryBuilder({ error: null });
        return transactionsInsertBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    };

    await expect(createTransaction({}, validFormData())).rejects.toThrow("REDIRECT:/transactions");

    expect(transactionsInsertBuilder!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ matched_recurring_expense_id: null })
    );
    expect(recurringCallCount).toBe(1); // only the candidate fetch, never an update
  });
});

describe("updateTransaction", () => {
  it("redirects to the detail page on success", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "transactions") return makeQueryBuilder({ data: { id: "txn-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    };

    await expect(updateTransaction("txn-1", {}, validFormData())).rejects.toThrow(
      "REDIRECT:/transactions/txn-1"
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions/txn-1");
  });

  it("returns 'no longer exists' when the row doesn't match (stale/foreign id)", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "transactions") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    };

    const result = await updateTransaction("txn-1", {}, validFormData());
    expect(result.error).toBe("This transaction no longer exists.");
  });
});

describe("deleteTransaction", () => {
  it("deletes and revalidates on success", async () => {
    fromImpl = () => makeQueryBuilder({ data: { id: "txn-1" }, error: null });

    const result = await deleteTransaction("txn-1");
    expect(result).toEqual({});
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("returns 'no longer exists' when the row doesn't match", async () => {
    fromImpl = () => makeQueryBuilder({ data: null, error: null });

    const result = await deleteTransaction("txn-1");
    expect(result.error).toBe("This transaction no longer exists.");
  });

  it("returns a generic error when the delete fails", async () => {
    fromImpl = () => makeQueryBuilder({ error: { message: "boom" } });

    const result = await deleteTransaction("txn-1");
    expect(result.error).toBe("Could not delete this transaction. Please try again.");
  });
});
