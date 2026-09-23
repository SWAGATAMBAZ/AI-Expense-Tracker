import { describe, expect, it, vi } from "vitest";
import { computeInsights, computeInsight } from "./insights";

/** A chainable, thenable query-builder stub that always resolves to `result` (mirrors app/actions/ai.test.ts's makeBuilder). */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const chainMethods = ["select", "eq", "gte", "lte", "order"] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: typeof result) => void) => resolve(result);
  return builder;
}

type TableMap = Record<string, { data?: unknown; error?: unknown }>;

function makeSupabase(tables: TableMap) {
  return {
    from: vi.fn((table: string) => makeBuilder(tables[table] ?? { data: null, error: null })),
  } as never;
}

const categories = [
  { id: 1, name: "Shopping" },
  { id: 2, name: "Food & Dining" },
];

const emptyTables: TableMap = {
  categories: { data: categories, error: null },
  profiles: { data: { currency: "INR", monthly_salary: null }, error: null },
  transactions: { data: [], error: null },
  recurring_expenses: { data: [], error: null },
};

describe("computeInsights", () => {
  it("always returns exactly one insight per key, in a fixed order", async () => {
    const supabase = makeSupabase(emptyTables);
    const insights = await computeInsights(supabase, "user-1");
    expect(insights.map((i) => i.key)).toEqual(["top-category", "upcoming-bill", "savings-forecast"]);
  });

  it("names the biggest spending category with its amount and share", async () => {
    const supabase = makeSupabase({
      ...emptyTables,
      transactions: {
        data: [
          { amount: 3000_00, type: "expense", category_id: 1, payment_method: "UPI" },
          { amount: 1000_00, type: "expense", category_id: 2, payment_method: "Cash" },
        ],
        error: null,
      },
    });

    const insights = await computeInsights(supabase, "user-1");
    const top = insights.find((i) => i.key === "top-category")!;

    expect(top.title).toContain("Shopping");
    expect(top.message).toContain("75%");
  });

  it("falls back to explanatory copy when there's no spending yet this month", async () => {
    const supabase = makeSupabase(emptyTables);
    const insights = await computeInsights(supabase, "user-1");
    const top = insights.find((i) => i.key === "top-category")!;
    expect(top.title).toMatch(/no spending/i);
  });

  it("surfaces the soonest upcoming recurring expense", async () => {
    const supabase = makeSupabase({
      ...emptyTables,
      recurring_expenses: {
        data: [
          {
            id: "r1",
            name: "Netflix",
            amount: 649_00,
            frequency: "monthly",
            next_due_date: "2099-01-05",
            active: true,
          },
        ],
        error: null,
      },
    });

    const insights = await computeInsights(supabase, "user-1");
    const upcoming = insights.find((i) => i.key === "upcoming-bill")!;
    expect(upcoming.title).toContain("Netflix");
  });

  it("says so when there are no upcoming bills", async () => {
    const supabase = makeSupabase(emptyTables);
    const insights = await computeInsights(supabase, "user-1");
    const upcoming = insights.find((i) => i.key === "upcoming-bill")!;
    expect(upcoming.title).toMatch(/no upcoming bills/i);
  });

  it("flags an over-budget month instead of projecting a positive savings figure", async () => {
    const supabase = makeSupabase({
      ...emptyTables,
      profiles: { data: { currency: "INR", monthly_salary: 10_000_00 }, error: null },
      transactions: {
        data: [{ amount: 50_000_00, type: "expense", category_id: 1, payment_method: "UPI" }],
        error: null,
      },
    });

    const insights = await computeInsights(supabase, "user-1");
    const savings = insights.find((i) => i.key === "savings-forecast")!;
    expect(savings.title).toMatch(/over budget/i);
  });

  it("projects a positive savings figure when income comfortably covers spend", async () => {
    const supabase = makeSupabase({
      ...emptyTables,
      profiles: { data: { currency: "INR", monthly_salary: 60_000_00 }, error: null },
      transactions: {
        data: [{ amount: 10_000_00, type: "expense", category_id: 1, payment_method: "UPI" }],
        error: null,
      },
    });

    const insights = await computeInsights(supabase, "user-1");
    const savings = insights.find((i) => i.key === "savings-forecast")!;
    expect(savings.title).toBe("This month's savings");
    expect(savings.message).toContain("50,000");
  });

  it("prompts to set up a salary when none is configured", async () => {
    const supabase = makeSupabase(emptyTables);
    const insights = await computeInsights(supabase, "user-1");
    const savings = insights.find((i) => i.key === "savings-forecast")!;
    expect(savings.title).toMatch(/set up your salary/i);
  });
});

describe("computeInsight", () => {
  it("returns just the requested key's insight", async () => {
    const supabase = makeSupabase(emptyTables);
    const insight = await computeInsight(supabase, "user-1", "upcoming-bill");
    expect(insight?.key).toBe("upcoming-bill");
  });
});
