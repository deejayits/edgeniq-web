import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Admin-only shell. Outer /app layout already enforces session; this
// just adds the role gate. `primary_admin` and `admin` both pass —
// matches the bot's is_admin() which treats both tiers as admin.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
  if (role !== "admin" && role !== "primary_admin") {
    redirect("/app");
  }
  return <>{children}</>;
}
