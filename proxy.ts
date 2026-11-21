import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Refreshes the Supabase session cookie and keeps the whole site behind sign-in.
export async function proxy(request: NextRequest) {
  // Only this isolated demonstration is public in local development. It uses no
  // backend data or write actions. All other pages/APIs retain their sign-in rules.
  if(process.env.NODE_ENV === 'development' && request.nextUrl.pathname === '/preview/light-study') {
    return NextResponse.next();
  }
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
  const path = request.nextUrl.pathname;
  if (user && path === "/signin") return NextResponse.redirect(new URL("/", request.url));
  if (user) {
    // New accounts wait on /waiting until an admin admits them. Only pages are
    // checked here; the database itself refuses data to waiting accounts.
    if (!needsAdmissionCheck(path)) return response;
    const admitted = await isAdmitted(supabase);
    if (admitted === (path === "/waiting")) return withCookies(NextResponse.redirect(new URL(admitted ? "/" : "/waiting", request.url)), response);
    return response;
  }
  if (isPublic(path)) return response;

  // Signed out: APIs answer 401, pages go to the sign-in screen.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const signIn = request.nextUrl.clone();
  signIn.pathname = "/signin";
  signIn.search = "";
  return withCookies(NextResponse.redirect(signIn), response);
}

// Keep any refreshed/cleared auth cookies on a redirect.
function withCookies(redirect: NextResponse, response: NextResponse) {
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function needsAdmissionCheck(path: string) {
  // Pages only: not APIs, sign-in links, the password page or files such as icons.
  return !path.startsWith("/api/") && !path.startsWith("/auth/") && path !== "/password" && !/\.[a-z0-9]+$/i.test(path) && !isPublic(path);
}

/**
 * Closed by default: only an explicit "approved" from the database lets someone
 * in. Errors, a missing setup or any other answer keep them on /waiting.
 */
async function isAdmitted(supabase: ReturnType<typeof createServerClient>) {
  try {
    const { data, error } = await supabase.rpc("my_membership");
    return !error && (data as { status?: unknown } | null)?.status === "approved";
  } catch {
    return false;
  }
}

function isPublic(path: string) {
  return path === "/signin" || path.startsWith("/auth/") || path === "/manifest.webmanifest" || /^\/(apple-touch-icon|icon-\d+)\.png$/.test(path);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
