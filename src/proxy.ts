import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "dashboard-auth";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const dashboardPassword = process.env.DASHBOARD_PASSWORD;

  // No password configured — fail open (dev mode without env var)
  if (!dashboardPassword) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE);

  if (cookie?.value === dashboardPassword) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to /login
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
