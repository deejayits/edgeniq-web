import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Next.js 16 renamed middleware → proxy. Same capabilities, different
// names. Protects /app/** routes. Unauthenticated users get redirected
// to /login with ?next=<path> so we can bounce them back after sign-in.
export const proxy = auth((req) => {
  const isApp = req.nextUrl.pathname.startsWith("/app");
  if (!isApp) return NextResponse.next();

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const proxyConfig = {
  // Match everything except static assets, Next internals, and auth
  // routes themselves.
  matcher: ["/((?!_next|api/auth|.*\\.(?:png|jpg|jpeg|svg|ico|webp|avif)).*)"],
};
