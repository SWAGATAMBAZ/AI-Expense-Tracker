import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildMessages } from "./prompt";

describe("buildSystemPrompt", () => {
  it("includes today's date and the category list", () => {
    const prompt = buildSystemPrompt({ today: "2026-09-14", categories: ["Food & Dining", "Rent"] });
    expect(prompt).toContain("2026-09-14");
    expect(prompt).toContain("Food & Dining");
    expect(prompt).toContain("Rent");
  });

  it("says nothing about a pending intent when there isn't one", () => {
    const prompt = buildSystemPrompt({ today: "2026-09-14", categories: [] });
    expect(prompt).not.toContain("incomplete intent");
  });

  it("embeds the pending intent and missing fields when merging a clarification answer", () => {
    const prompt = buildSystemPrompt({
      today: "2026-09-14",
      categories: [],
      pendingIntent: { action: "add_transaction", merchant: "Zomato" },
      missingFields: ["amount"],
    });
    expect(prompt).toContain("incomplete intent");
    expect(prompt).toContain('"merchant":"Zomato"');
    expect(prompt).toContain("amount");
  });

  it("says nothing about currency when none is given", () => {
    const prompt = buildSystemPrompt({ today: "2026-09-14", categories: [] });
    expect(prompt).not.toContain("account currency");
  });

  it("adds a currency-mismatch clarify rule when a currency is given", () => {
    const prompt = buildSystemPrompt({ today: "2026-09-14", categories: [], currency: "INR" });
    expect(prompt).toContain("account currency is INR");
    expect(prompt).toContain("clarify");
  });
});

describe("buildMessages", () => {
  it("returns a system message followed by the user's text", () => {
    const messages = buildMessages("spent 500 on lunch", { today: "2026-09-14", categories: [] });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "spent 500 on lunch" });
  });
});
