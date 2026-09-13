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

    if (!user) {
      return { isAuthenticated: false, onboardingCompleted: false, response };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
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
