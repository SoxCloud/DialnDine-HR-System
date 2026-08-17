/**
 * lib/passwords.js
 *
 * Scrypt password hashing for the Employees sheet Password column.
 * Format: "scrypt$N$r$p$salt$hash" (N=16384, r=8, p=1 by default).
 * Node's crypto.scrypt is used; this module is Node-runtime only.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt$";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * 1024 * 1024;

/** Hash a plaintext password into a self-describing "scrypt$..." string. */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(String(password), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM });
  return `${PREFIX}${N}$${R}$${P}$${salt}$${derived.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored value.
 * Supports hashed ("scrypt$...") and legacy plaintext values. Returns boolean.
 */
export function verifyPassword(password, stored) {
  const storedValue = String(stored ?? "");
  if (!storedValue) return false;
  const plain = String(password);

  if (storedValue.startsWith(PREFIX)) {
    const parts = storedValue.split("$");
    if (parts.length !== 6) return false;
    const [, n, r, p, salt, hashHex] = parts;
    const derived = scryptSync(plain, salt, KEY_LENGTH, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEM,
    });
    const expected = Buffer.from(hashHex, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }

  // Legacy plaintext — equal only if stored non-empty and exactly matching.
  return storedValue === plain;
}