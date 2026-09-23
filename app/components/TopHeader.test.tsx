import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopHeader } from "./TopHeader";

describe("TopHeader", () => {
  it("shows the Spendify logo linking home, an Inbox link, and the menu trigger", () => {
    render(<TopHeader isDemoMode={false} />);

    expect(screen.getByRole("link", { name: /spendify home/i })).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: /inbox/i })).toHaveAttribute("href", "/inbox");
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });
});
