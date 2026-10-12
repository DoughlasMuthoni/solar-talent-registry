import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Optimistic gate for admin routes + Supabase session refresh.
 * NOT the security boundary: every admin page, data read and server action calls requireAdmin().
 */
export async function proxy(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // No auth configured: refuse admin routes in production; development uses the dev admin (see lib/auth/session.ts).
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Admin sign-in is not configured.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Refreshes an expired access token and writes the new cookies onto `response`.
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/candidates/:path*", "/assessments/:path*", "/messages/:path*", "/scoring-rules/:path*", "/account/:path*"],
};
