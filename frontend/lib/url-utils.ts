/**
 * Ensures a base URL has a scheme (http/https). Without it, anchor hrefs are
 * treated as relative and resolve against the current origin.
 */
export function ensureAbsoluteUrl(
  base: string | undefined,
  fallback: string
): string {
  const value = (base ?? fallback).trim().replace(/\/+$/, "");
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
}
