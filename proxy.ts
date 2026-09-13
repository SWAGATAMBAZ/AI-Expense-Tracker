import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveRedirect } from "@/lib/auth/routing";

export async function proxy(request: NextRequest) {
  const { isAuthenticated, onboardingCompleted, response } = await updateSession(request);

  const redirectPath = resolveRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated,
    onboardingCompleted,
  });

  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|apple-touch-icon.png|icons/).*)",
  ],
};
