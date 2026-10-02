/*
 * Pure string matching, no database access. This lives apart from
 * the reader because the form that uses it is a client component,
 * and client code cannot touch next/headers.
 */

export function matchesChain(name: string, patterns: string[]): string | null {
  const clean = name.trim().toLowerCase();

  if (!clean) return null;

  return patterns.find((pattern) => clean.includes(pattern)) ?? null;
}
