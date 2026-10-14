/** URL-safe slug: lowercase ascii words joined by hyphens. */
export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Escapes a user string for literal use inside a RegExp. */
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Returns `base`, or `base-2`, `base-3`, ... whichever `exists(slug)` reports free.
 */
export async function uniqueSlug(base, exists) {
  const root = base || 'item';
  let candidate = root;
  for (let n = 2; await exists(candidate); n += 1) candidate = `${root}-${n}`;
  return candidate;
}
