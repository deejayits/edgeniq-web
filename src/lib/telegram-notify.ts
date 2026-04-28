import "server-only";
import { env } from "@/env";

// ----------------------------------------------------------------------
// Web → Telegram DM bridge
// ----------------------------------------------------------------------
//
// State changes a user makes on the web (flip to live, engage kill
// switch, plan upgrade, exit-override edit) deserve a record in the
// chat — not a popup the user might miss when they're not at the
// keyboard. The bot is the user's audit feed; web changes that
// don't fire a DM disappear into the void.
//
// We talk directly to the Telegram Bot API from the Vercel server
// action — no polling, no shared state. The bot token lives in the
// same env var the bot itself uses, so a successful send means the
// chat actually got the message.
//
// Best-effort: failures NEVER throw out of the helper. Logging an
// audit DM that doesn't land is bad UX, but it's worse to fail the
// user's actual action (e.g. "switching to live failed because
// Telegram API was down") because of an audit-trail problem.

const TELEGRAM_API = "https://api.telegram.org/bot";

// Marker in the message body that means "footer already appended."
// Idempotent — if a caller pre-formats their own footer with this
// emoji, we won't double-append. Mirrors the bot's _SIGNATURE_MARKER.
const SIGNATURE_MARKER = "📅 sent";

export type DmResult = { ok: boolean; error?: string };

/**
 * Append an ET sent-at footer to outgoing message bodies. Mirrors
 * the bot-side `_append_signature` helper in notifier.py so DMs
 * originating on the web carry the same `📅 sent <Mon> <D>, <H:MM>
 * AM/PM ET` line every other bot response has. Without this,
 * web-originated DMs (rule changes, kill-switch, plan upgrades)
 * looked subtly different from native bot replies.
 *
 * Idempotent: if the body already contains the signature marker
 * we leave it alone, so a caller pre-formatting their own footer
 * doesn't get a doubled stamp.
 */
function appendSignature(html: string): string {
  if (html.includes(SIGNATURE_MARKER)) return html;
  let stamp: string;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    stamp = fmt.format(new Date());
  } catch {
    return html;
  }
  return `${html}\n\n<i>📅 sent ${stamp} ET</i>`;
}

/**
 * Send an HTML-formatted message to a user's Telegram chat.
 *
 * Mirrors the bot's send_to_user surface — same parse mode, same
 * disable-web-page-preview default, same ET sent-at footer.
 * Returns {ok: false, error} on failure but never throws; callers
 * are typically in server actions that don't want a notification
 * failure to roll back the action itself.
 */
export async function sendBotDM(
  chatId: number,
  html: string,
  opts?: { disableWebPagePreview?: boolean },
): Promise<DmResult> {
  if (!chatId || chatId <= 0) {
    return { ok: false, error: "invalid chat_id" };
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "bot token not configured" };
  }
  const stamped = appendSignature(html);
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: stamped,
        parse_mode: "HTML",
        disable_web_page_preview: opts?.disableWebPagePreview ?? true,
      }),
      // 5s — enough for normal rtt + Telegram processing, short enough
      // that a stuck request doesn't bottleneck the action.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `telegram ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/**
 * Fire-and-forget variant for cases where we don't even want to
 * await the network call before returning to the user. Logs the
 * result but never affects the caller's flow.
 *
 * Useful inside server actions: the action returns immediately on
 * the success of the DB write; the DM is dispatched asynchronously
 * so the user doesn't wait on Telegram's network round-trip.
 */
export function sendBotDMFireAndForget(
  chatId: number,
  html: string,
): void {
  // Discard the promise — Vercel's serverless functions DO finish
  // pending promises before suspending, so this still completes,
  // but we don't make the action wait.
  void sendBotDM(chatId, html).catch(() => {
    /* swallowed — best effort */
  });
}
