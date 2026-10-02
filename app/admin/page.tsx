import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, Badge } from "@/components/ui";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/services/settings";
import { describeDays } from "@/lib/services/freshness";

export default async function AdminPage() {
  const admin = await isAdmin();

  if (!admin) {
    redirect("/");
  }

  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("place_reports")
    .select("id, place_id, reason, created_at, resolved")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const reportList = reports ?? [];
  const placeIds = [...new Set(reportList.map((r) => r.place_id))];

  const { data: places } = placeIds.length
    ? await supabase.from("places").select("id, name").in("id", placeIds)
    : { data: [] };

  const nameById = new Map((places ?? []).map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <p className="text-sm text-slate-600">
        {reportList.length} open {reportList.length === 1 ? "report" : "reports"}.
      </p>

      {reportList.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Nothing waiting. The map is holding up.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {reportList.map((report) => (
            <li key={report.id}>
              <Card padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/place/${report.place_id}`}
                    className="font-semibold text-slate-900 underline"
                  >
                    {nameById.get(report.place_id) ?? "Unknown place"}
                  </Link>

                  <Badge className="bg-amber-100 text-amber-800">
                    {describeDays(daysSince(report.created_at))}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-slate-700">{report.reason}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function daysSince(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  );
}
