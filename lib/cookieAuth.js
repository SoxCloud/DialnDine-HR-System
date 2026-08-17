/**
 * lib/cookieAuth.js
 *
 * Sign/verify the `hr_role` session cookie with an HMAC so the role stored
 * there cannot be forged. Uses the Web Crypto API so it runs on both the
 * Edge runtime (proxy.ts) and Node runtime (API routes).
 *
 * Cookie value format: "ROLE.SIGNATURE" where SIGNATURE is the HMAC-SHA256
 * (base64url) of ROLE keyed by AUTH_SECRET.
 */

const SESSION_ROLE_COOKIE = "hr_role";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

async function hmacKey(secret) {
  const encoded = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    encoded,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Sign a role value into a "ROLE.SIGNATURE" cookie string. */
export async function signRole(role) {
  const secret = getSecret();
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(role))
  );
  return `${role}.${bytesToBase64Url(signature)}`;
}

/** Verify a "ROLE.SIGNATURE" cookie value. Returns the verified role string,
 *  or null when the value is missing/malformed/forged. */
export async function verifyRole(value) {
  if (typeof value !== "string") return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const role = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!role || !signature) return null;

  const secret = getSecret();
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    new TextEncoder().encode(role)
  );
  return valid ? role : null;
}

/** Read the raw (signed) role cookie from a Request/NextRequest. */
export function readRoleCookie(request) {
  const value =
    request.cookies?.get?.(SESSION_ROLE_COOKIE)?.value ??
    request.headers?.get?.("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_ROLE_COOKIE}=`))
      ?.slice(`${SESSION_ROLE_COOKIE}=`.length);
  return typeof value === "string" ? value : null;
}

export { SESSION_ROLE_COOKIE };