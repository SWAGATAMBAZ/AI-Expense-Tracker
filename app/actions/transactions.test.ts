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
      if (table === "transactions") return makeQueryBuilder({ error: null });
      throw new Error(`unexpected table ${table}`);
    };

    await expect(createTransaction({}, validFormData())).rejects.toThrow("REDIRECT:/transactions");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("returns a generic error when the insert fails", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "profiles") return makeQueryBuilder({ data: { currency: "INR" } });
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
