import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const signInMock = vi.fn();

vi.mock("@/app/actions/auth", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows the error message returned by the sign-in action", async () => {
    signInMock.mockResolvedValue({ error: "Incorrect email or password." });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });
  });
});
