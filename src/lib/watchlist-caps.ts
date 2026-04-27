// Per-tier watchlist caps. Mirrors notifications/users.py constants
// in the bot so the gate is identical on both surfaces. Lives in a
// neutral module (not "use server") so server components AND server
// actions can both import — server-actions files can only export
// async functions, which is why this can't live alongside
// settings/actions.ts.
//
//   Free trial: 25 (matches Pro so trial→Pro is no surprise downgrade)
//   Pro:        25 (focused-list tier, watchlist-only stock signals)
//   Elite:     100 (plus whole-market discovery beyond the watchlist)

import { isEliteAccess, isProAccess, type AccessUser } from "./access";

export const WATCHLIST_CAP_FREE = 25;
export const WATCHLIST_CAP_PRO = 25;
export const WATCHLIST_CAP_ELITE = 100;

export function watchlistCapFromRow(accessUser: AccessUser): number {
  if (isEliteAccess(accessUser)) return WATCHLIST_CAP_ELITE;
  if (isProAccess(accessUser)) return WATCHLIST_CAP_PRO;
  return WATCHLIST_CAP_FREE;
}
