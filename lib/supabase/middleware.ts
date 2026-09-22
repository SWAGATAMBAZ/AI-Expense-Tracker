import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export interface SessionInfo {
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  response: NextResponse;
}

export async function updateSession(request: NextRequest): Promise<SessionInfo> {
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // getUser() (not getSession()) revalidates against the auth server —
    // required for a correct middleware-based session refresh.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let effectiveUser = user;

    // Public-demo prototype mode (not a supported auth model - see
    // README/DEPLOY notes): when DEMO_USER_EMAIL/PASSWORD are set, every
    // visitor with no session of their own is transparently signed into one
    // shared demo account, so the deployed link needs no login screen and
    // everyone sees/edits the same seeded data. Unset in normal deployments,
    // in which case this is a no-op and auth works exactly as before.
    if (!effectiveUser && process.env.DEMO_USER_EMAIL && process.env.DEMO_USER_PASSWORD) {
      const { data: demoSignIn, error: demoError } = await supabase.auth.signInWithPassword({
        email: process.env.DEMO_USER_EMAIL,
        password: process.env.DEMO_USER_PASSWORD,
      });
      if (demoError) {
        console.error("[proxy] demo auto sign-in failed:", demoError.message);
      } else {
        effectiveUser = demoSignIn.user;
      }
    }

    if (!effectiveUser) {
      return { isAuthenticated: false, onboardingCompleted: false, response };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", effectiveUser.id)
      .maybeSingle();

    return {
      isAuthenticated: true,
      // A missing row (shouldn't happen given the DB trigger) is treated
      // defensively as "not onboarded" rather than throwing.
      onboardingCompleted: profile?.onboarding_completed ?? false,
      response,
    };
  } catch (error) {
    // Misconfigured env vars, an unreachable Supabase project, or any other
    // failure here must never take down every page (including public ones
    // like /login). Fail safe as "signed out" and let the app degrade
    // rather than 500.
    console.error("[proxy] Supabase session check failed:", error);
    return { isAuthenticated: false, onboardingCompleted: false, response };
  }
}
