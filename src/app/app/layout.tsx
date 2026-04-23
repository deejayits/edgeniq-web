import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";

// Protected dashboard shell. Middleware already gates /app/** but we
// re-verify the session here so server components downstream can trust
// the session object. Also exposes the user to the nav.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/app");
  }
  const user = session.user as {
    name?: string | null;
    image?: string | null;
    tgUserId?: number;
    role?: string;
    subPlan?: string;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/app">
              <BrandMark />
            </Link>
            <AppNav />
          </div>
          <UserMenu
            name={user.name ?? ""}
            image={user.image ?? null}
            role={user.role ?? "user"}
            subPlan={user.subPlan ?? "free"}
          />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
