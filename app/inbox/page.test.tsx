import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import InboxPage from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1", email: "test@example.com" } },
      })),
    },
  })),
}));

vi.mock("@/lib/ai/insights", () => ({
  computeInsights: vi.fn(async () => [
    { key: "top-category", title: "Biggest spend: Shopping", message: "Shopping is your biggest spend this month." },
    { key: "upcoming-bill", title: "Upcoming: Netflix", message: "Netflix (₹649.00) is due 5 Jan." },
    { key: "savings-forecast", title: "This month's savings", message: "You're on track to save ₹50,000.00 this month." },
  ]),
}));

describe("InboxPage", () => {
  it("shows all 3 insight cards, each linking to a fresh AI chat for that insight", async () => {
    const ui = await InboxPage();
    render(ui);

    expect(screen.getByText("Biggest spend: Shopping")).toBeInTheDocument();
    expect(screen.getByText("Upcoming: Netflix")).toBeInTheDocument();
    expect(screen.getByText("This month's savings")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /discuss with ai/i });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/ai?new=1&insight=top-category");
    expect(links[1]).toHaveAttribute("href", "/ai?new=1&insight=upcoming-bill");
    expect(links[2]).toHaveAttribute("href", "/ai?new=1&insight=savings-forecast");
  });

  it("has a way back home", async () => {
    const ui = await InboxPage();
    render(ui);
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute("href", "/home");
  });
});
