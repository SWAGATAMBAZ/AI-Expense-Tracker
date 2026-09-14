import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const mockRevalidatePath = vi.fn();
const mockUnstableRethrow = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
  unstable_rethrow: (error: unknown) => mockUnstableRethrow(error),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

function makeQueryBuilder(result: { error?: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(async () => result);
  return builder;
}

let fromImpl: (table: string) => unknown;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => fromImpl(table)),
  })),
}));

import { completeOnboarding, updateProfile } from "./profile";

const validFormData = () => {
  const fd = new FormData();
  fd.set("fullName", "Jane Doe");
  fd.set("salary", "50000");
  fd.set("salaryDay", "1");
  fd.set("currency", "INR");
  fd.set("bankInfo", "");
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("completeOnboarding", () => {
  it("returns field errors without hitting the database when validation fails", async () => {
    const fd = validFormData();
    fd.set("fullName", "");

    const result = await completeOnboarding({}, fd);
    expect(result.fieldErrors?.fullName).toBeTruthy();
  });

  it("saves the profile, revalidates /home, and redirects on success", async () => {
    fromImpl = () => makeQueryBuilder({ error: null });

    await expect(completeOnboarding({}, validFormData())).rejects.toThrow("REDIRECT:/home");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
  });

  it("returns a session error when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await completeOnboarding({}, validFormData());
    expect(result.error).toBe("Your session expired. Please log in again.");
  });
});

describe("updateProfile", () => {
  it("returns field errors without hitting the database when validation fails", async () => {
    const fd = validFormData();
    fd.set("salary", "-1");

    const result = await updateProfile({}, fd);
    expect(result.fieldErrors?.salary).toBeTruthy();
  });

  it("saves and revalidates /profile and /home on success, without redirecting", async () => {
    fromImpl = () => makeQueryBuilder({ error: null });

    const result = await updateProfile({}, validFormData());
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/home");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns a generic error when the update fails", async () => {
    fromImpl = () => makeQueryBuilder({ error: { message: "boom" } });

    const result = await updateProfile({}, validFormData());
    expect(result.error).toBe("Could not save your changes. Please try again.");
  });
});
