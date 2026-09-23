import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "@/app/page";

describe("LandingPage", () => {
  it("renders the headline and both call-to-action links", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { name: /spendify/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
