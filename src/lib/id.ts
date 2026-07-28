/** Timestamp + random suffix — unique enough for local, single-device use. No new dependency. */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Lowercase, hyphenated slug from a human-readable name (e.g. "Dry Goods" -> "dry-goods"). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
