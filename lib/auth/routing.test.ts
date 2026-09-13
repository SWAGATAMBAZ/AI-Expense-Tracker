import { describe, expect, it } from "vitest";
import { resolveRedirect } from "./routing";

describe("resolveRedirect", () => {
  it("lets a signed-out user reach public paths", () => {
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: false, onboardingCompleted: false })
    ).toBeNull();
    expect(
      resolveRedirect({ pathname: "/register", isAuthenticated: false, onboardingCompleted: false })
    ).toBeNull();
  });

  it("redirects a signed-out user away from protected paths", () => {
    expect(
      resolveRedirect({ pathname: "/", isAuthenticated: false, onboardingCompleted: false })
    ).toBe("/login");
    expect(
      resolveRedirect({ pathname: "/profile", isAuthenticated: false, onboardingCompleted: false })
    ).toBe("/login");
    expect(
      resolveRedirect({ pathname: "/onboarding", isAuthenticated: false, onboardingCompleted: false })
    ).toBe("/login");
  });

  it("lets a signed-in, not-onboarded user stay on /onboarding", () => {
    expect(
      resolveRedirect({ pathname: "/onboarding", isAuthenticated: true, onboardingCompleted: false })
    ).toBeNull();
  });

  it("redirects a signed-in, not-onboarded user to /onboarding from anywhere else", () => {
    expect(
      resolveRedirect({ pathname: "/", isAuthenticated: true, onboardingCompleted: false })
    ).toBe("/onboarding");
    expect(
      resolveRedirect({ pathname: "/profile", isAuthenticated: true, onboardingCompleted: false })
    ).toBe("/onboarding");
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: true, onboardingCompleted: false })
    ).toBe("/onboarding");
    expect(
      resolveRedirect({ pathname: "/register", isAuthenticated: true, onboardingCompleted: false })
    ).toBe("/onboarding");
  });

  it("redirects a fully onboarded user away from login/register/onboarding", () => {
    expect(
      resolveRedirect({ pathname: "/login", isAuthenticated: true, onboardingCompleted: true })
    ).toBe("/");
    expect(
      resolveRedirect({ pathname: "/register", isAuthenticated: true, onboardingCompleted: true })
    ).toBe("/");
    expect(
      resolveRedirect({ pathname: "/onboarding", isAuthenticated: true, onboardingCompleted: true })
    ).toBe("/");
  });

  it("lets a fully onboarded user reach normal protected paths", () => {
    expect(
      resolveRedirect({ pathname: "/", isAuthenticated: true, onboardingCompleted: true })
    ).toBeNull();
    expect(
      resolveRedirect({ pathname: "/profile", isAuthenticated: true, onboardingCompleted: true })
    ).toBeNull();
  });
});
