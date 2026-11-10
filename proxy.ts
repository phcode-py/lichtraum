import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Refreshes the Supabase session cookie and keeps the whole site behind sign-in.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user && request.nextUrl.pathname === "/signin") return NextResponse.redirect(new URL("/", request.url));
  if (user || isPublic(request.nextUrl.pathname)) return response;

  // Signed out: APIs answer 401, pages go to the sign-in screen.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const signIn = request.nextUrl.clone();
  signIn.pathname = "/signin";
  signIn.search = "";
  const redirect = NextResponse.redirect(signIn);
  // Keep any refreshed/cleared auth cookies.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function isPublic(path: string) {
  return path === "/signin" || path.startsWith("/auth/");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
