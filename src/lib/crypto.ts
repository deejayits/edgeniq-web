import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/env";

// AES-256-GCM envelope for broker API credentials. Every broker_connection
// row stores the encrypted Alpaca key + secret as JSON { iv, ciphertext,
// auth_tag }, all base64. Plaintext only ever exists in process memory —
// Supabase sees ciphertext; the key lives in TRADING_ENCRYPTION_KEY on
// the server, never on the client.
//
// Rotation note: changing TRADING_ENCRYPTION_KEY requires re-encrypting
// every stored credential row. Don't rotate casually.

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV is the GCM best-practice default
const AUTH_TAG_LENGTH = 16;

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
  auth_tag: string;
};

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  const raw = env.TRADING_ENCRYPTION_KEY;
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      "TRADING_ENCRYPTION_KEY must be base64 encoding of exactly 32 bytes",
    );
  }
  _key = decoded;
  return _key;
}

export function encrypt(plaintext: string): EncryptedBlob {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("cannot encrypt empty plaintext");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(blob: EncryptedBlob): string {
  const iv = Buffer.from(blob.iv, "base64");
  const ciphertext = Buffer.from(blob.ciphertext, "base64");
  const authTag = Buffer.from(blob.auth_tag, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`invalid iv length: ${iv.length}`);
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
