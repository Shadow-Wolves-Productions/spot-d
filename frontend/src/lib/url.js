/**
 * URL helpers — applied everywhere we render or persist an external URL,
 * so users can type "imdb.me/x" without breaking the link.
 */

export function ensureAbsoluteUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Already absolute (including mailto: / tel: / sms:)
  if (/^(https?|mailto|tel|sms):/i.test(trimmed)) return trimmed;
  // protocol-relative
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function ensureMailto(email) {
  if (!email || typeof email !== "string") return "";
  const e = email.trim();
  if (!e) return "";
  return e.startsWith("mailto:") ? e : `mailto:${e}`;
}

/**
 * Strip protocol + trailing slash for clean display.
 * "https://www.imdb.me/brendanbyrne/" → "imdb.me/brendanbyrne"
 */
export function displayUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

/** Format an Instagram handle: keeps "@handle" or strips a full URL. */
export function displayHandle(value) {
  if (!value) return "";
  const v = value.trim();
  if (v.startsWith("@")) return v;
  return "@" + displayUrl(v).replace(/^instagram\.com\//i, "");
}
