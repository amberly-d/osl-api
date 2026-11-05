/** Slugs that would collide with routes or look like official pages. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'docs',
  'docs-json',
  'health',
  'login',
  'logout',
  'new',
  'settings',
  'projects',
]);

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/** Lowercase letters, digits and hyphens; starts and ends with a letter or digit. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Returns a human-readable problem, or `undefined` when the slug is valid. */
export function slugProblem(slug: unknown): string | undefined {
  if (typeof slug !== 'string') {
    return 'slug must be a string.';
  }
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return `slug must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters long.`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return 'slug may only contain lowercase letters, digits and hyphens, and must start and end with a letter or digit.';
  }
  if (RESERVED_SLUGS.has(slug)) {
    return `slug "${slug}" is reserved.`;
  }
  return undefined;
}

export function isValidSlug(slug: unknown): boolean {
  return slugProblem(slug) === undefined;
}
