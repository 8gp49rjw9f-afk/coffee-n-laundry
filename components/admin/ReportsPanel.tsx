"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Card, Badge } from "@/components/ui";

import { resolveReport, restorePlace } from "@/app/actions/admin";

/*
 * Two tables, one tab, chosen by `?view=`.
 *
 *   Reporting — the places people have reported, with the decision
 *               buttons. This is the queue, and it is what existed
 *               before.
 *
 *   Flagged   — the places a moderator marked doubtful, with the
 *               button that lifts the mark.
 *
 * WHY THE SECOND TABLE HAD TO EXIST
 *
 * Flagging a place resolves every report against it — that is what
 * the decision means. And Reporting only lists places that still have
 * open reports. So the moment a moderator flags a place, it leaves
 * the queue, and the "Mark it good again" button left with it: the
 * one screen that could undo the flag was the one screen the flag
 * removed the place from. A moderator who flagged by mistake had no
 * way back except SQL.
 *
 * The two tables read different things on purpose. Reporting reads
 * reports; Flagged reads `places.status`. That is the difference
 * between "somebody complained" and "a decision was taken", and the
 * second survives the decision that produced it.
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

export interface FlaggedPlace {
  id: string;
  name: string;
  place_type: string;
  city: string | null;
  country: string | null;
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
      </div>
    </Card>
  );
}

/*
 * One row per flagged place, with the one button that applies.
 *
 * No Dismiss and no Close here: this table is about places already
 * carrying a decision. The only move left is to take it back.
 */
function FlaggedCard({ place }: { place: FlaggedPlace }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function unflag() {
    setError("");

    startTransition(async () => {
      try {
        await restorePlace(place.id);
        setDone(true);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not lift that flag."
        );
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/place/${place.id}`}
            className="truncate font-semibold text-slate-900 underline"
          >
            {place.name}
          </Link>

          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[place.city, place.country].filter(Boolean).join(" · ") ||
              "No location recorded"}
          </p>
        </div>

        <Badge className="bg-slate-200 text-slate-700">Flagged</Badge>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={unflag}
        disabled={pending || done}
        className="mt-3 min-h-10 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
      >
        {done
          ? "✓ Flag lifted"
          : pending
            ? "Lifting…"
            : "Mark it good again"}
      </button>
    </Card>
  );
}

/*
 * The two views, as a small switch at the top.
 *
 * Links rather than client-side state: the view ends up in the URL,
 * so it can be bookmarked and shared, and the tab keeps working
 * without JavaScript — the same reasoning as the search term one
 * level up.
 */
function ViewSwitch({ view }: { view: "reporting" | "flagged" }) {
  const options = [
    { key: "reporting", label: "Reporting" },
    { key: "flagged", label: "Flagged" },
  ] as const;

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <Link
          key={option.key}
          href={`/admin?tab=moderation&view=${option.key}`}
          className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${
            view === option.key
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

export function ReportsPanel({
  groups,
  flagged,
  view,
}: {
  groups: ReportGroup[];
  flagged: FlaggedPlace[];
  view: "reporting" | "flagged";
}) {
  return (
    <div className="space-y-3">
      <ViewSwitch view={view} />

      {view === "flagged" ? (
        flagged.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              No place is marked doubtful. Nothing to put right.
            </p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {flagged.length} {flagged.length === 1 ? "place" : "places"}{" "}
              flagged. Marking one good again puts it back on the map without
              its warning.
            </p>

            {flagged.map((place) => (
              <FlaggedCard key={place.id} place={place} />
            ))}
          </>
        )
      ) : groups.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Nothing waiting. The map is holding up.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {groups.length} {groups.length === 1 ? "place" : "places"} reported.
            Deciding about one closes every report against it.
          </p>

          {groups.map((group) => (
            <GroupCard key={group.placeId} group={group} />
          ))}
        </>
      )}
    </div>
  );
}

export default ReportsPanel;
