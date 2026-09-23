import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

let pathname = "/home";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("BottomNav", () => {
  it("shows all 5 quick actions on the home page", () => {
    pathname = "/home";
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /transactions/i })).toHaveAttribute(
      "href",
      "/transactions"
    );
    expect(screen.getByRole("link", { name: /add recurring expense/i })).toHaveAttribute(
      "href",
      "/recurring/new"
    );
    expect(screen.getByRole("link", { name: /ai feature/i })).toHaveAttribute("href", "/ai");
    expect(screen.getByRole("link", { name: /add expense/i })).toHaveAttribute(
      "href",
      "/transactions/new"
    );
    expect(screen.getByRole("link", { name: /credit cards/i })).toHaveAttribute("href", "/cards");
  });

  it("no longer shows an Account link - reachable via the home page's own menu instead", () => {
    pathname = "/home";
    render(<BottomNav />);

    expect(screen.queryByRole("link", { name: /^account$/i })).not.toBeInTheDocument();
  });

  it("is a persistent app-wide nav: also shown on form/detail sub-pages", () => {
    for (const path of [
      "/transactions/new",
      "/transactions/txn-1",
      "/transactions/txn-1/edit",
      "/recurring/new",
      "/recurring/rec-1/edit",
    ]) {
      pathname = path;
      const { container, unmount } = render(<BottomNav />);
      expect(container).not.toBeEmptyDOMElement();
      unmount();
    }
  });

  it("renders nothing on public/auth/onboarding pages", () => {
    for (const path of ["/", "/login", "/register", "/onboarding"]) {
      pathname = path;
      const { container, unmount } = render(<BottomNav />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("highlights Add expense (not Transactions) on /transactions/new", () => {
    pathname = "/transactions/new";
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /^add expense$/i })).toHaveClass(
      "border-[var(--color-primary)]"
    );
    expect(screen.getByRole("link", { name: /^transactions$/i })).not.toHaveClass(
      "border-[var(--color-primary)]"
    );
  });

  it("highlights Transactions on a transaction detail/edit page", () => {
    pathname = "/transactions/txn-1/edit";
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /^transactions$/i })).toHaveClass(
      "border-[var(--color-primary)]"
    );
  });
});
