import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OnboardingPage from "./page";

const completeOnboardingMock = vi.fn();

vi.mock("@/app/actions/profile", () => ({
  completeOnboarding: (...args: unknown[]) => completeOnboardingMock(...args),
}));

describe("OnboardingPage", () => {
  it("renders salary, salary day, currency, and optional bank info fields", () => {
    render(<OnboardingPage />);
    expect(screen.getByLabelText(/monthly salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/salary day/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferred currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bank\/payment info/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("defaults the currency select to INR", () => {
    render(<OnboardingPage />);
    expect(screen.getByLabelText(/preferred currency/i)).toHaveValue("INR");
  });

  it("shows field-level errors returned by the action", async () => {
    completeOnboardingMock.mockResolvedValue({
      fieldErrors: { salary: "Salary must be greater than zero." },
    });

    render(<OnboardingPage />);
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/salary must be greater than zero/i)).toBeInTheDocument();
    });
  });
});
