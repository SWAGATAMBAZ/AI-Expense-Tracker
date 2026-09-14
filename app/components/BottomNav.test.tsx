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
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute("href", "/profile");
  });

  it("renders nothing on a form/task page like /transactions/new", () => {
    pathname = "/transactions/new";
    const { container } = render(<BottomNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on public/auth pages", () => {
    pathname = "/login";
    const { container } = render(<BottomNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
