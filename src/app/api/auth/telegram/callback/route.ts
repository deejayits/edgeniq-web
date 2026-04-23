import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/auth";

// Telegram Login Widget redirects here with auth params as query string.
// We delegate to Auth.js's signIn() which runs our Credentials provider's
// authorize() callback (hash verification happens there).
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    // Auth.js signIn() will redirect on success or throw CredentialsSignin
    // on failure. With redirect:true it handles the 302 for us.
    await signIn("telegram", {
      ...params,
      redirect: true,
      redirectTo: "/app",
    });
    // Unreachable — signIn() throws a redirect-thrown NEXT_REDIRECT.
    return NextResponse.redirect(new URL("/app", req.url));
  } catch (e: unknown) {
    // Auth.js throws NEXT_REDIRECT error which Next catches and turns
    // into a redirect. If it's not that, it's a real failure.
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) {
      throw e;
    }
    console.error("[telegram-callback] sign-in failed:", e);
    return NextResponse.redirect(
      new URL("/login?error=telegram_auth_failed", req.url),
    );
  }
}
