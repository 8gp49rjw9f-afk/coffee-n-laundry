import { Card, Button, ErrorBanner } from "@/components/ui";

import { saveSettings } from "@/app/actions/admin";

import { SettingsForm } from "./SettingsForm";

import type { SiteSettings } from "@/lib/services/settings";

/*
 * The five groups, and why each one is here rather than alphabetical.
 *
 *   Identity      — what the site says it is.
 *   Subscription  — what it costs, and what a credit is worth.
 *   Maintenance   — whether it is up at all.
 *   Participation — who may take part, and how much.
 *   Content       — what people may write, and how long it may be.
 *   Moderation    — when a place gets flagged.
 *   Map           — where it opens, and how many pins it draws.
 *
 * Subscription is new. The three values existed in the database and
 * were read by the pricing page, but no form had ever written them —
 * so `subscription_price_usd` was frozen at 1, `free_period_days` at
 * 365 and `credits_per_free_month` at 100 since the day they were
 * seeded. Somebody could read the price on the pricing page and
 * nobody could change it.
 *
 * One warning that matters: `credits_per_free_month` is the number
 * that decides when a month becomes free. If it is raised from 100 to
 * 200, somebody sitting on 150 credits has not lost the month they
 * already earned — the credit ledger is untouched. The threshold only
 * applies to what comes next. Lowering it gives the month away
 * sooner, which is your call to make.
 */

export function SettingsPanel({ settings }: { settings: SiteSettings }) {
  return <SettingsForm settings={settings} />;
}

export default SettingsPanel;
