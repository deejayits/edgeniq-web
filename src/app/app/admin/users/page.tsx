import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeaderStat } from "@/components/header-stat";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AdminUserRow, type AdminUserRowData } from "./user-row";

export const dynamic = "force-dynamic";

type UserRow = {
  chat_id: number;
  username: string | null;
  name: string | null;
  status: string | null;
  role: string | null;
  sub_plan: string | null;
  sub_status: string | null;
  sub_expires_at: string | null;
  last_seen_at: string | null;
  signals_received: number | null;
  watchlist: string[] | null;
  deleted: boolean | null;
  trial_used_at: string | null;
};

export default async function AdminUsersPage() {
  const supabase = supabaseAdmin();
  // Fetch all non-deleted users. Sort by trial-active first (so the
  // admin sees the most time-sensitive accounts at the top), then by
  // last_seen descending.
  const { data: rows, error } = await supabase
    .from("users")
    .select(
      "chat_id, username, name, status, role, sub_plan, sub_status, " +
        "sub_expires_at, last_seen_at, signals_received, watchlist, deleted, " +
        "trial_used_at",
    )
    .or("deleted.is.null,deleted.eq.false")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <Card className="p-6 border-destructive/40 bg-destructive/10 text-sm">
          Failed to load users: {error.message}
        </Card>
      </div>
    );
  }

  const users: UserRow[] = (rows ?? []) as unknown as UserRow[];

  const total = users.length;
  const onTrial = users.filter((u) => u.sub_status === "trial").length;
  const elite = users.filter((u) => u.sub_plan === "elite").length;
  const pro = users.filter((u) => u.sub_plan === "pro").length;
  const expired = users.filter((u) => u.sub_status === "expired").length;

  const mapped: AdminUserRowData[] = users.map((u) => ({
    chatId: u.chat_id,
    username: u.username ?? "",
    name: u.name ?? "",
    status: u.status ?? "active",
    role: u.role ?? "user",
    subPlan: u.sub_plan ?? "free",
    subStatus: u.sub_status ?? "active",
    subExpiresAt: u.sub_expires_at,
    lastSeenAt: u.last_seen_at,
    signalsReceived: u.signals_received ?? 0,
    watchlistCount: (u.watchlist ?? []).length,
    trialUsedAt: u.trial_used_at,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Manage subscriptions, revoke access, suspend abusers. Changes
            here sync to the Telegram bot on the next command.
          </p>
        </div>
        <div className="flex items-stretch gap-3">
          <HeaderStat
            label="Total"
            value={total.toLocaleString()}
            sub="all users"
            tone="muted"
          />
          <HeaderStat
            label="Elite"
            value={`${elite}`}
            sub={total > 0 ? `${((elite / total) * 100).toFixed(0)}%` : "—"}
            tone="primary"
          />
          <HeaderStat
            label="Pro"
            value={`${pro}`}
            sub={total > 0 ? `${((pro / total) * 100).toFixed(0)}%` : "—"}
            tone="emerald"
          />
        </div>
      </header>

      {/* Smaller secondary chips for trial/suspended/etc — not big
          enough to deserve HeaderStat tiles, but useful as quick
          filters when scanning the table. */}
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
          {onTrial} on trial
        </Badge>
        {expired > 0 && (
          <Badge
            variant="outline"
            className="border-rose-400/40 text-rose-300 bg-rose-400/10"
          >
            {expired} expired
          </Badge>
        )}
      </div>

      <Card className="border-border/60 bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">
                  User
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Sub
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Account
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Last seen
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Activity
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mapped.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    No users yet.
                  </td>
                </tr>
              ) : (
                mapped.map((u) => <AdminUserRow key={u.chatId} u={u} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
