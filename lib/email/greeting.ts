/**
 * Greeting helpers for lifecycle email. A profile row may carry an email
 * address where a name should be (older rows) or nothing at all; never let
 * either reach a subject line or salutation.
 */

/** First name from a full name; null for empty values or anything that looks like an email. */
export function firstNameFrom(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed || trimmed.includes('@')) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first || first.length > 40) return null;
  return first;
}

/** "Hi Mehdi," / "Hi there," */
export function salutation(fullName: string | null | undefined): string {
  const first = firstNameFrom(fullName);
  return `Hi ${first ?? 'there'},`;
}

/** " at BiPER Therapeutics" or "" — for one-line context in a sentence. */
export function companyClause(companyName: string | null | undefined): string {
  const c = companyName?.trim();
  return c ? ` at ${c}` : '';
}
