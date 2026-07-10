// Sanitizes a user-supplied post-auth redirect target down to a same-origin
// path. Prefix checks are not enough here: browsers follow the WHATWG URL
// spec, which treats "\" as "/" in special-scheme URLs and strips tabs and
// newlines before parsing — so "/\evil.com" and "/\t/evil.com" both navigate
// off-origin despite starting with a single "/". Parsing with the URL class
// against a sentinel base mirrors what the browser will actually do: anything
// that resolves off the sentinel origin is rejected.

const SENTINEL_BASE = "https://sentinel.invalid";

/**
 * Returns a safe same-origin path (path + query + hash) derived from `raw`,
 * or `fallback` when `raw` is missing, not a string (Next.js searchParams
 * yield string[] for repeated params), or resolves outside the current origin.
 */
export function sanitizeCallbackUrl(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    const url = new URL(raw, SENTINEL_BASE);
    if (url.origin !== SENTINEL_BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
