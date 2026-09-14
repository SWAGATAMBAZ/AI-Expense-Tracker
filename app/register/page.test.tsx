import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterPage from "./page";

const signUpMock = vi.fn();

vi.mock("@/app/actions/auth", () => ({
  signUp: (...args: unknown[]) => signUpMock(...args),
}));

describe("RegisterPage", () => {
  it("renders name, email, password, and confirm password fields", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows the error message returned by the sign-up action", async () => {
    signUpMock.mockResolvedValue({
      error: "An account with this email already exists. Try logging in instead.",
    });

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jordan Rivera" },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "taken@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password123" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }).closest("form")!
    );

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it("shows a check-your-email panel instead of the form when confirmation is required", async () => {
    signUpMock.mockResolvedValue({ emailConfirmationRequired: true });

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Jordan Rivera" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "jordan@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password123" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }).closest("form")!
    );

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login");
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });
});
