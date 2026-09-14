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
  { id: 1, name: "Bills & Utilities" },
  { id: 2, name: "Subscriptions" },
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

import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpenseActive,
  skipRecurringExpenseCycle,
} from "./recurring";

const validFormData = () => {
  const fd = new FormData();
  fd.set("name", "Rent");
  fd.set("amount", "20000");
  fd.set("frequency", "monthly");
  fd.set("nextDueDate", "2026-02-01");
  fd.set("categoryId", "1");
  fd.set("paymentMethod", "Bank Transfer");
  fd.set("accountInfo", "");
  fd.set("active", "on");
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("createRecurringExpense", () => {
  it("returns field errors without hitting the database when validation fails", async () => {
    fromImpl = () => makeQueryBuilder({ data: categoriesRows });
    const fd = validFormData();
    fd.set("name", "");

    const result = await createRecurringExpense({}, fd);
    expect(result.fieldErrors?.name).toBeTruthy();
  });

  it("inserts and redirects on success", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "recurring_expenses") return makeQueryBuilder({ error: null });
      throw new Error(`unexpected table ${table}`);
    };

    await expect(createRecurringExpense({}, validFormData())).rejects.toThrow(
      "REDIRECT:/recurring"
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recurring");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
  });

  it("returns a generic error when the insert fails", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "recurring_expenses") return makeQueryBuilder({ error: { message: "boom" } });
      throw new Error(`unexpected table ${table}`);
    };

    const result = await createRecurringExpense({}, validFormData());
    expect(result.error).toBe("Could not save this recurring expense. Please try again.");
  });

  it("returns a session error when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    fromImpl = () => makeQueryBuilder({ data: categoriesRows });

    const result = await createRecurringExpense({}, validFormData());
    expect(result.error).toBe("Your session expired. Please log in again.");
  });
});

describe("updateRecurringExpense", () => {
  it("redirects to /recurring on success", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "recurring_expenses")
        return makeQueryBuilder({ data: { id: "rec-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    };

    await expect(updateRecurringExpense("rec-1", {}, validFormData())).rejects.toThrow(
      "REDIRECT:/recurring"
    );
  });

  it("returns 'no longer exists' for a stale/foreign id", async () => {
    fromImpl = (table: string) => {
      if (table === "categories") return makeQueryBuilder({ data: categoriesRows });
      if (table === "recurring_expenses") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    };

    const result = await updateRecurringExpense("rec-1", {}, validFormData());
    expect(result.error).toBe("This recurring expense no longer exists.");
  });
});

describe("deleteRecurringExpense", () => {
  it("deletes and revalidates on success", async () => {
    fromImpl = () => makeQueryBuilder({ data: { id: "rec-1" }, error: null });

    const result = await deleteRecurringExpense("rec-1");
    expect(result).toEqual({});
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recurring");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
  });

  it("returns 'no longer exists' when the row doesn't match", async () => {
    fromImpl = () => makeQueryBuilder({ data: null, error: null });

    const result = await deleteRecurringExpense("rec-1");
    expect(result.error).toBe("This recurring expense no longer exists.");
  });
});

describe("toggleRecurringExpenseActive", () => {
  it("updates the active flag and revalidates", async () => {
    fromImpl = () => makeQueryBuilder({ data: { id: "rec-1" }, error: null });

    const result = await toggleRecurringExpenseActive("rec-1", false);
    expect(result).toEqual({});
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recurring");
  });

  it("returns a generic error on failure", async () => {
    fromImpl = () => makeQueryBuilder({ error: { message: "boom" } });

    const result = await toggleRecurringExpenseActive("rec-1", true);
    expect(result.error).toBe("Could not update this recurring expense. Please try again.");
  });
});

describe("skipRecurringExpenseCycle", () => {
  it("advances next_due_date by one cycle and revalidates", async () => {
    let updateBuilder: ReturnType<typeof makeQueryBuilder> | undefined;
    let callCount = 0;

    fromImpl = (table: string) => {
      if (table !== "recurring_expenses") throw new Error(`unexpected table ${table}`);
      callCount++;
      if (callCount === 1) {
        return makeQueryBuilder({
          data: { next_due_date: "2026-02-01", frequency: "monthly" },
          error: null,
        });
      }
      updateBuilder = makeQueryBuilder({ error: null });
      return updateBuilder;
    };

    const result = await skipRecurringExpenseCycle("rec-1");
    expect(result).toEqual({});
    expect(updateBuilder!.update).toHaveBeenCalledWith(
      expect.objectContaining({ next_due_date: "2026-03-01" })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recurring");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
  });

  it("returns 'no longer exists' when the row doesn't match", async () => {
    fromImpl = () => makeQueryBuilder({ data: null, error: null });

    const result = await skipRecurringExpenseCycle("rec-1");
    expect(result.error).toBe("This recurring expense no longer exists.");
  });

  it("returns a generic error when the fetch fails", async () => {
    fromImpl = () => makeQueryBuilder({ error: { message: "boom" } });

    const result = await skipRecurringExpenseCycle("rec-1");
    expect(result.error).toBe("Could not update this recurring expense. Please try again.");
  });
});
