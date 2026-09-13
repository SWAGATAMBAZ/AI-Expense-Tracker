import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const mockUnstableRethrow = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
  unstable_rethrow: (error: unknown) => mockUnstableRethrow(error),
}));

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  })),
}));

import { signUp, signIn, signOut } from "./auth";

function formDataFrom(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signUp", () => {
  const validFields = {
    name: "Jordan Rivera",
    email: "jordan@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("rejects a missing name without calling Supabase", async () => {
    const result = await signUp({}, formDataFrom({ ...validFields, name: "" }));
    expect(result.error).toBe("Name is required.");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling Supabase", async () => {
    const result = await signUp(
      {},
      formDataFrom({ ...validFields, confirmPassword: "different123" })
    );
    expect(result.error).toBe("Passwords do not match.");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("returns emailConfirmationRequired when Supabase returns no session", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    const result = await signUp({}, formDataFrom(validFields));
    expect(result).toEqual({ emailConfirmationRequired: true });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to onboarding when Supabase returns a real session", async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    await expect(signUp({}, formDataFrom(validFields))).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("maps a known Supabase error to a friendly message", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered" },
    });

    const result = await signUp({}, formDataFrom(validFields));
    expect(result.error).toBe("An account with this email already exists. Try logging in instead.");
  });

  it("falls back to a generic message for an unmapped Supabase error", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: "some unexpected supabase message" },
    });

    const result = await signUp({}, formDataFrom(validFields));
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("handles an unexpected thrown exception gracefully", async () => {
    mockSignUp.mockRejectedValue(new Error("network down"));

    const result = await signUp({}, formDataFrom(validFields));
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(mockUnstableRethrow).toHaveBeenCalled();
  });
});

describe("signIn", () => {
  const validFields = { email: "jordan@example.com", password: "password123" };

  it("maps 'Email not confirmed' to a specific, actionable message", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Email not confirmed" } });

    const result = await signIn({}, formDataFrom(validFields));
    expect(result.error).toBe(
      "Please confirm your email before logging in — check your inbox for the confirmation link we sent you."
    );
  });

  it("maps invalid credentials to a friendly message", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const result = await signIn({}, formDataFrom(validFields));
    expect(result.error).toBe("Incorrect email or password.");
  });

  it("redirects to /home on success", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    await expect(signIn({}, formDataFrom(validFields))).rejects.toThrow("REDIRECT:/home");
  });
});

describe("signOut", () => {
  it("signs out and redirects to /login", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(mockSignOut).toHaveBeenCalled();
  });
});
