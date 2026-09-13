import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the app heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: /ai expense tracker/i })
    ).toBeInTheDocument();
  });
});
