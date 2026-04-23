import crypto from "node:crypto";

// Telegram Login Widget payload — every field other than `hash` is
// part of the data-check-string. Telegram docs:
// https://core.telegram.org/widgets/login#receiving-authorization-data
export type TelegramAuthPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

// Verify the HMAC-SHA256 hash Telegram signs the payload with. Rejects
// stale payloads (> AUTH_MAX_AGE_SECONDS old) to prevent replay.
const AUTH_MAX_AGE_SECONDS = 86_400; // 24 hours

export function verifyTelegramAuth(
  payload: Record<string, string>,
  botToken: string,
): { ok: true; data: TelegramAuthPayload } | { ok: false; reason: string } {
  const { hash, ...fields } = payload;
  if (!hash) return { ok: false, reason: "missing hash" };

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (
    expected.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))
  ) {
    return { ok: false, reason: "invalid hash" };
  }

  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: "missing auth_date" };
  }
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > AUTH_MAX_AGE_SECONDS) {
    return { ok: false, reason: `auth_date stale (${ageSec}s old)` };
  }
  if (ageSec < -60) {
    return { ok: false, reason: "auth_date from the future" };
  }

  return {
    ok: true,
    data: {
      id: Number(fields.id),
      first_name: fields.first_name,
      last_name: fields.last_name,
      username: fields.username,
      photo_url: fields.photo_url,
      auth_date: authDate,
      hash,
    },
  };
}
