export interface ResolveRedirectInput {
  pathname: string;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
}

const PUBLIC_PATHS = new Set(["/login", "/register"]);
const ONBOARDING_PATH = "/onboarding";

/** Returns the path to redirect to, or null if the request should proceed unchanged. */
export function resolveRedirect({
  pathname,
  isAuthenticated,
  onboardingCompleted,
}: ResolveRedirectInput): string | null {
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!isAuthenticated) {
    return isPublic ? null : "/login";
  }

  // Authenticated from here on.
  if (!onboardingCompleted) {
    return pathname === ONBOARDING_PATH ? null : ONBOARDING_PATH;
  }

  // Authenticated + onboarded.
  if (isPublic || pathname === ONBOARDING_PATH) {
    return "/";
  }

  return null;
}
