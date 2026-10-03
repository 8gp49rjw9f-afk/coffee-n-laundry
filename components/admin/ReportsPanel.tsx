"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Card, Badge } from "@/components/ui";

import { resolveReport, restorePlace } from "@/app/actions/admin";

/*
 * One card per place, with every open report against it inside. A
 * queue of individual reports would ask the same question as many
 * times as there are reports; a place is the unit an admin actually
 * decides about.
 *
 * Three outcomes, and they are genuinely different:
 *
 *   Dismiss — the report was wrong. Nothing about the place changes.
 *   Flag    — doubtful. It stays on the map, wearing a warning.
 *   Close   — gone. It leaves the map.
 */

export interface ReportGroup {
  placeId: string;
  place: {
    id: string;
    name: string;
    status: string;
    place_type: string;
    city: string | null;
    country: string | null;
  } | null;
  reports: { id: string; reason: string; created_at: string }[];
}

function daysSince(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  );
}

function GroupCard({ group }: { group: ReportGroup }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(outcome: "reject" | "flag" | "close") {
    setError("");

    const formData = new FormData();
    formData.set("place_id", group.placeId);
    formData.set("outcome", outcome);

    startTransition(async () => {
      try {
        await resolveReport(formData);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not close that report."
        );
      }
    });
  }

  function restore() {
    setError("");

    startTransition(async () => {
      try {
        await restorePlace(group.placeId);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not restore that place."
        );
      }
    });
  }

  const status = group.place?.status ?? "active";

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/place/${group.placeId}`}
            className="truncate font-semibold text-slate-900 underline"
          >
            {group.place?.name ?? "Unknown place"}
          </Link>

          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[group.place?.city, group.place?.country]
              .filter(Boolean)
              .join(" · ") || "No location recorded"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className="bg-amber-100 text-amber-800">
            {group.reports.length}{" "}
            {group.reports.length === 1 ? "report" : "reports"}
          </Badge>

          {status !== "active" && (
            <Badge
              className={
                status === "closed"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-slate-200 text-slate-700"
              }
            >
              {status === "closed" ? "Closed" : "Flagged"}
            </Badge>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {group.reports.map((report) => (
          <li
            key={report.id}
            className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <p>{report.reason}</p>

            <p className="mt-1 text-xs text-slate-400">
              {daysSince(report.created_at)} days ago
            </p>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("reject")}
          disabled={pending}
          className="min-h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Dismiss
        </button>

        <button
          type="button"
          onClick={() => decide("flag")}
          disabled={pending}
          className="min-h-10 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
        >
          Flag it
        </button>

        <button
          type="button"
          onClick={() => decide("close")}
          disabled={pending}
          className="min-h-10 flex-1 rounded-xl border border-rose-300 bg-rose-50 px-3 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50"
        >
          Close it
        </button>

        {status !== "active" && (
          <button
            type="button"
            onClick={restore}
            disabled={pending}
            className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Mark it good again
          </button>
        )}
      </div>
    </Card>
  );
}

export function ReportsPanel({ groups }: { groups: ReportGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          Nothing waiting. The map is holding up.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {groups.length} {groups.length === 1 ? "place" : "places"} reported.
        Deciding about one closes every report against it.
      </p>

      {groups.map((group) => (
        <GroupCard key={group.placeId} group={group} />
      ))}
    </div>
  );
}

export default ReportsPanel;
