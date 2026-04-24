// Thin Alpaca REST wrapper — paper endpoint only for now. Live endpoint
// is plumbed as a one-constant swap for when Phase 3 (live trading)
// ships. The caller never picks a URL; they pass mode='paper'|'live'
// and we resolve the base internally.
//
// Scope: only what /app/broker and the auto-trader actually need.
//   - GET /v2/account  (used on connect to validate + cache metadata)
//   - POST /v2/orders  (simple + bracket orders)
//   - DELETE /v2/orders  (kill switch)
//   - GET /v2/orders/{id}  (reconciliation)
// Everything else (positions listing, portfolio history, etc.) can be
// added later without touching the callers.

export type AlpacaMode = "paper" | "live";

const PAPER_BASE = "https://paper-api.alpaca.markets";
const LIVE_BASE = "https://api.alpaca.markets";

export type AlpacaAccount = {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
};

export type AlpacaOrder = {
  id: string;
  client_order_id: string;
  status:
    | "new"
    | "accepted"
    | "partially_filled"
    | "filled"
    | "done_for_day"
    | "canceled"
    | "expired"
    | "replaced"
    | "pending_cancel"
    | "pending_replace"
    | "pending_new"
    | "rejected"
    | "suspended"
    | "calculated";
  symbol: string;
  qty: string;
  filled_qty: string;
  side: "buy" | "sell";
  type: string;
  order_class?: string;
  limit_price?: string | null;
  stop_price?: string | null;
  filled_avg_price?: string | null;
  legs?: AlpacaOrder[] | null;
  submitted_at: string;
  filled_at?: string | null;
  canceled_at?: string | null;
  expired_at?: string | null;
  failed_at?: string | null;
  rejected_at?: string | null;
};

export class AlpacaError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`Alpaca ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = "AlpacaError";
  }
}

export class AlpacaClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly mode: AlpacaMode = "paper",
  ) {
    if (!apiKey || !apiSecret) {
      throw new Error("AlpacaClient: apiKey and apiSecret are required");
    }
  }

  private get baseUrl(): string {
    return this.mode === "paper" ? PAPER_BASE : LIVE_BASE;
  }

  private async req<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "APCA-API-KEY-ID": this.apiKey,
        "APCA-API-SECRET-KEY": this.apiSecret,
        accept: "application/json",
        ...(init?.body
          ? { "content-type": "application/json" }
          : {}),
        ...(init?.headers ?? {}),
      },
      // Alpaca is sometimes slow at the edges of market open/close — 15s is
      // generous but we don't want to block the bot's tick loop forever.
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new AlpacaError(res.status, body, path);
    }
    // DELETE /v2/orders returns 207 with a body of per-order results;
    // we don't need the shape, just that it didn't throw.
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  // --- account ----------------------------------------------------------

  getAccount(): Promise<AlpacaAccount> {
    return this.req<AlpacaAccount>("/v2/account");
  }

  // --- orders ----------------------------------------------------------

  /**
   * Submit a bracket order — entry + take-profit + stop in one shot.
   * Alpaca's bracket model auto-cancels the other leg when one fills,
   * which is exactly what our signal model wants (target OR stop, not
   * both). Pass target_price + stop_price together; omit both for a
   * simple order.
   */
  submitBracketOrder(args: {
    symbol: string;
    qty: number;
    side: "buy" | "sell";
    target_price?: number;
    stop_price?: number;
    limit_price?: number;
    /** Idempotency — same client_order_id will not double-submit. */
    client_order_id?: string;
  }): Promise<AlpacaOrder> {
    const body: Record<string, unknown> = {
      symbol: args.symbol,
      qty: String(args.qty),
      side: args.side,
      type: args.limit_price != null ? "limit" : "market",
      time_in_force: "day",
    };
    if (args.limit_price != null) {
      body.limit_price = args.limit_price.toFixed(2);
    }
    if (args.client_order_id) {
      body.client_order_id = args.client_order_id;
    }
    if (args.target_price != null && args.stop_price != null) {
      body.order_class = "bracket";
      body.take_profit = { limit_price: args.target_price.toFixed(2) };
      body.stop_loss = { stop_price: args.stop_price.toFixed(2) };
    }
    return this.req<AlpacaOrder>("/v2/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  getOrder(orderId: string): Promise<AlpacaOrder> {
    return this.req<AlpacaOrder>(`/v2/orders/${orderId}`);
  }

  /**
   * Cancel every open order on the account. Used by the kill switch.
   * Alpaca returns 207 with a per-order status body; we don't inspect
   * it — the GET /v2/orders poll will reconcile state.
   */
  cancelAllOrders(): Promise<void> {
    return this.req<void>("/v2/orders", { method: "DELETE" });
  }
}

/**
 * Quick sanity: does the key/secret pair authenticate against Alpaca's
 * paper (or live) API? Used by the /app/broker connect form's "Test
 * connection" button before persisting credentials.
 */
export async function testConnection(
  apiKey: string,
  apiSecret: string,
  mode: AlpacaMode = "paper",
): Promise<AlpacaAccount> {
  const client = new AlpacaClient(apiKey, apiSecret, mode);
  return client.getAccount();
}
