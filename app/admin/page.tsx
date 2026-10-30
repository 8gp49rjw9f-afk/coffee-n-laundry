import { redirect } from "next/navigation";

import Link from "next/link";

import { Card } from "@/components/ui";

import { createClient } from "@/lib/supabase/server";
import { currentAdmin, isMaster } from "@/lib/services/admin";

import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { CreditRulesPanel } from "@/components/admin/CreditRulesPanel";
import { ReportsPanel } from "@/components/admin/ReportsPanel";
import { AdminsPanel } from "@/components/admin/AdminsPanel";
import { UserSearch } from "@/components/admin/UserSearch";
import { BannedPanel, type BannedRow } from "@/components/admin/BannedPanel";

import type { CreditRuleRow } from "@/components/admin/CreditRulesPanel";
import type { ReportGroup, FlaggedPlace } from "@/components/admin/ReportsPanel";
import type { AdminRow } from "@/components/admin/AdminsPanel";

/*
 * Five sections, one page. They are all short, and an admin who has
 * to navigate between five routes to flip a switch will stop
 * bothering.
 *
 * Which tabs exist depends on the level: the Master tab appears only
 * for the account that decides who the admins are. The server actions
 * check the same thing again — this is presentation, not protection.
 */

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; view?: string }>;
}) {
  const admin = await currentAdmin();

  if (!admin) {
    redirect("/");
  }

  const query = await searchParams;

  const master = await isMaster();

  const tabs = [
    { key: "settings", label: "Site", emoji: "⚙️" },
    { key: "rewards", label: "Rewards", emoji: "🏅" },
    { key: "moderation", label: "Moderation", emoji: "🚩" },
    { key: "users", label: "Users", emoji: "👤" },
    { key: "banned", label: "Banned", emoji: "🚫" },
    ...(master ? [{ key: "admins", label: "Admins", emoji: "🔑" }] : []),
  ];

  const active = tabs.some((t) => t.key === query.tab)
    ? (query.tab as string)
    : "settings";

  /*
   * Two tables inside Moderation, chosen by `?view=`. It lives in the
   * URL for the same reason the search term does: a view can then be
   * shared or bookmarked, and the tab still works without JavaScript.
   */
  const view = query.view === "flagged" ? "flagged" : "reporting";

  /* The search term lives in the URL, which is what lets the field
     work without JavaScript and lets a result page be shared. */
  const term = typeof query.q === "string" ? query.q : "";

  const supabase = await createClient();

  /* ---------- what each section needs ---------- */

  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const { data: rules } = await supabase
    .from("credit_rules")
    .select("action_key, credits, daily_cap, description, active")
    .order("credits", { ascending: false });

  const { data: reports } = await supabase
    .from("place_reports")
    .select("id, place_id, reason, created_at")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const reportList = reports ?? [];
  const placeIds = [...new Set(reportList.map((r) => r.place_id))];

  const { data: places } = placeIds.length
    ? await supabase
        .from("places")
        .select("id, name, status, place_type, city, country")
        .in("id", placeIds)
    : { data: [] };

  const placeById = new Map((places ?? []).map((p) => [p.id, p]));

  const groups: ReportGroup[] = placeIds
    .map((id) => ({
      placeId: id,
      place: placeById.get(id) ?? null,
      reports: reportList
        .filter((r) => r.place_id === id)
        .map((r) => ({
          id: r.id,
          reason: r.reason,
          created_at: r.created_at,
        })),
    }))
    .sort((a, b) => b.reports.length - a.reports.length);

  /*
   * The flagged table, read separately.
   *
   * It is deliberately NOT built from the reports above. A place that
   * was flagged has had every report against it resolved — that is
   * what flagging does — so once the decision is made the place
   * vanishes from Reporting, and the button that would undo the flag
   * vanishes with it. That left an admin who flagged a place by
   * mistake with no way back except SQL.
   *
   * So this reads the places themselves, on `status`, which is the
   * fact the flag actually recorded. `unverified` only: a place a
   * moderator CLOSED is a different decision with a different button,
   * and mixing the two in one list would blur which is which.
   */
  const { data: flaggedRows } = await supabase
    .from("places")
    .select("id, name, place_type, city, country, status")
    .eq("status", "unverified")
    .order("name")
    .limit(200);

  const flagged: FlaggedPlace[] = (flaggedRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    place_type: row.place_type,
    city: row.city,
    country: row.country,
  }));

  /* `notify_email` comes along with the rest: the switch on each row
     renders from it, and without the column every switch would draw
     as off while the database says on. */
  const { data: adminRows } = master
    ? await supabase
        .from("admins")
        .select("email, is_master, created_at, notify_email")
    : { data: null };

  /*
   * The Banned tab. One call, and 0026 decides who may read it — it
   * raises ADMIN_ONLY for anybody else, which comes back as an error
   * rather than rows. That is why the failure is swallowed into an
   * empty list here: an admin page should still draw if this one
   * function is missing, and 0026 may not have been pasted yet.
   */
  const { data: bannedRows } = await supabase.rpc("list_banned_users");

  const banned = (bannedRows ?? []) as BannedRow[];

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>

        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-semibold">{admin.email}</span>
          {master && " · master account"}
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin?tab=${tab.key}`}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold transition ${
              active === tab.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.emoji} {tab.label}
          </Link>
        ))}
      </nav>

      {active === "settings" &&
        (settings ? (
          <SettingsPanel settings={settings} />
        ) : (
          <Card>
            <p className="text-sm text-slate-500">
              Site settings row is missing from the database.
            </p>
          </Card>
        ))}

      {active === "rewards" && (
        <CreditRulesPanel rules={(rules ?? []) as CreditRuleRow[]} />
      )}

      {active === "moderation" && (
        <ReportsPanel groups={groups} flagged={flagged} view={view} />
      )}

      {active === "users" && <UserSearch term={term} />}

      {active === "banned" && <BannedPanel rows={banned} />}

      {active === "admins" && master && (
        <AdminsPanel admins={(adminRows ?? []) as AdminRow[]} self={admin.email} />
      )}

      {/*
       * Two windows, and the sentence has to say both. Everything the
       * app reads lives behind a minute of cache; the maintenance
       * switch is read on a five-second window of its own, because an
       * emergency lever that takes a minute to bite is not one. Saying
       * only "once a minute" here made flipping the switch look like
       * it had done nothing.
       */}
      <p className="pb-8 text-center text-xs text-slate-400">
        Most settings are read by the app once a minute. The maintenance
        switch takes effect within a few seconds.
      </p>
    </main>
  );
}
