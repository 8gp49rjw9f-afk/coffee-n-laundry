import { redirect } from "next/navigation";

import Link from "next/link";

import { Card } from "@/components/ui";

import { createClient } from "@/lib/supabase/server";
import { currentAdmin, isMaster } from "@/lib/services/admin";

import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { CreditRulesPanel } from "@/components/admin/CreditRulesPanel";
import { ReportsPanel } from "@/components/admin/ReportsPanel";
import { AdminsPanel } from "@/components/admin/AdminsPanel";

import type { CreditRuleRow } from "@/components/admin/CreditRulesPanel";
import type { ReportGroup } from "@/components/admin/ReportsPanel";
import type { AdminRow } from "@/components/admin/AdminsPanel";

/*
 * Four sections, one page. They are all short, and an admin who has
 * to navigate between four routes to flip a switch will stop
 * bothering.
 *
 * Which tabs exist depends on the level: the Master tab appears only
 * for the account that decides who the admins are. The server actions
 * check the same thing again — this is presentation, not protection.
 */

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
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
    ...(master ? [{ key: "admins", label: "Admins", emoji: "🔑" }] : []),
  ];

  const active = tabs.some((t) => t.key === query.tab)
    ? (query.tab as string)
    : "settings";

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

  const { data: adminRows } = master
    ? await supabase.from("admins").select("email, is_master, created_at")
    : { data: null };

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

      {active === "moderation" && <ReportsPanel groups={groups} />}

      {active === "admins" && master && (
        <AdminsPanel admins={(adminRows ?? []) as AdminRow[]} self={admin.email} />
      )}

      <p className="pb-8 text-center text-xs text-slate-400">
        Settings are read by the app once a minute, so a change lands within
        that window.
      </p>
    </main>
  );
}
