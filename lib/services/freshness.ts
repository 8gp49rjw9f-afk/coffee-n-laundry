/* ====================================================== */
/* FRESHNESS — computed at read time, never stored.        */
/* No reputation score, no ranking: just facts.            */
/* ====================================================== */

export type FreshnessTier = "fresh" | "aging" | "stale" | "unknown";

export interface Freshness {
  tier: FreshnessTier;
  days: number | null;
  label: string;
  emoji: string;
  className: string;
}

const FRESH_MAX_DAYS = 45;
const AGING_MAX_DAYS = 180;

const UNKNOWN: Freshness = {
  tier: "unknown",
  days: null,
  label: "Never verified",
  emoji: "❔",
  className: "bg-slate-100 text-slate-600",
};

export function getFreshness(
  lastVerifiedAt: string | null | undefined,
  now: Date = new Date()
): Freshness {
  if (!lastVerifiedAt) return UNKNOWN;

  const then = new Date(lastVerifiedAt).getTime();

  if (Number.isNaN(then)) return UNKNOWN;

  const days = Math.max(
    0,
    Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24))
  );

  if (days <= FRESH_MAX_DAYS) {
    return {
      tier: "fresh",
      days,
      label: describeDays(days),
      emoji: "✅",
      className: "bg-emerald-100 text-emerald-800",
    };
  }

  if (days <= AGING_MAX_DAYS) {
    return {
      tier: "aging",
      days,
      label: describeDays(days),
      emoji: "🕓",
      className: "bg-amber-100 text-amber-800",
    };
  }

  return {
    tier: "stale",
    days,
    label: describeDays(days),
    emoji: "⚠️",
    className: "bg-rose-100 text-rose-800",
  };
}

export function describeDays(days: number): string {
  if (days === 0) return "verified today";
  if (days === 1) return "verified yesterday";
  if (days < 30) return `verified ${days} days ago`;

  const months = Math.round(days / 30);

  if (months <= 1) return "verified a month ago";
  if (months < 24) return `verified ${months} months ago`;

  const years = Math.round(months / 12);
  return years <= 1 ? "verified a year ago" : `verified ${years} years ago`;
}
