import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const PROTECTED_PREFIXES = ["/dashboard", "/reviews", "/billing"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie: { name: string; value: string }) =>
            request.cookies.set(cookie.name, cookie.value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach((cookie: { name: string; value: string; options?: object }) =>
            supabaseResponse.cookies.set(cookie.name, cookie.value, cookie.options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    // Do not add redirectTo without validation — would risk open redirects if used post-login.
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === LOGIN_PATH && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
