/**
 * Safe relative path for post-login redirects (blocks protocol-relative //, \\, : in path).
 * Falls back to `/dashboard` if `next` is missing or unsafe.
 */
export function getSafeRelativeRedirectPath(next: string | null): string {
  const fallback = "/dashboard";
  if (next == null) {
    return fallback;
  }
  const trimmed = next.trim();
  if (trimmed === "") {
    return fallback;
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  const pathOnly = trimmed.split(/[?#]/)[0] ?? trimmed;
  if (pathOnly.includes("\\") || pathOnly.includes(":")) {
    return fallback;
  }
  return trimmed;
}

/**
 * Client-side guard before assigning API-provided URLs to location.href.
 * Stripe Checkout hosted pages use checkout.stripe.com (test and live).
 */
const DEFAULT_TRUSTED_CHECKOUT_HOSTS = ["checkout.stripe.com"] as const;

function parseExtraAllowedHosts(): string[] {
  const raw = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_ALLOWED_HOSTS;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedHostname(hostname: string, allowed: ReadonlySet<string>): boolean {
  const h = hostname.toLowerCase();
  return allowed.has(h);
}

export type SafeCheckoutUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Returns a parsed https URL only if hostname is on the allowlist.
 * Rejects javascript: and other schemes, empty host, and non-https (prod-safe default).
 */
export function validateStripeCheckoutRedirectUrl(raw: string): SafeCheckoutUrlResult {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return { ok: false, reason: "Checkout URL is empty" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Checkout URL is not a valid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Checkout URL must use HTTPS" };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: "Checkout URL is missing a hostname" };
  }

  const allowed = new Set<string>([
    ...DEFAULT_TRUSTED_CHECKOUT_HOSTS,
    ...parseExtraAllowedHosts(),
  ]);

  if (!isAllowedHostname(parsed.hostname, allowed)) {
    return {
      ok: false,
      reason: "Checkout URL hostname is not an allowed Stripe checkout host",
    };
  }

  return { ok: true, url: parsed };
}
