import { Card } from "@/components/ui";

import { UPDATE_TYPE_LABEL } from "@/lib/format";
import { describeDays } from "@/lib/services/freshness";

interface TimelineUpdate {
  id: string;
  update_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  created_at: string;
}

/* No comments, no likes: a plain record of what changed. */

export function UpdateTimeline({
  updates,
  confirmations,
  lastConfirmedAt,
}: {
  updates: TimelineUpdate[];
  confirmations: number;
  lastConfirmedAt: string | null;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Recent updates
        </h2>

        {confirmations > 0 && (
          <span className="text-right text-xs font-semibold text-slate-500">
            👍 {confirmations} confirmed
            {lastConfirmedAt && (
              <span className="block text-[10px] font-normal text-slate-400">
                last on {formatDay(lastConfirmedAt)}
              </span>
            )}
          </span>
        )}
      </div>

      {updates.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nobody has updated this place yet. If something is wrong, you can be
          the first.
        </p>
      ) : (
        <ul className="space-y-3">
          {updates.map((update) => (
            <li
              key={update.id}
              className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
            >
              <span className="text-xl">{iconFor(update.update_type)}</span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {UPDATE_TYPE_LABEL[update.update_type] ?? "Update"}
                </p>

                {update.old_value || update.new_value ? (
                  <p className="mt-0.5 text-sm text-slate-600">
                    {update.old_value && (
                      <span className="line-through decoration-slate-400">
                        {update.old_value}
                      </span>
                    )}{" "}
                    → <strong>{update.new_value}</strong>
                  </p>
                ) : null}

                {update.comment && (
                  <p className="mt-0.5 text-sm text-slate-600">{update.comment}</p>
                )}

                <p className="mt-0.5 text-xs text-slate-400">
                  {describeDays(daysSince(update.created_at))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function iconFor(type: string) {
  return (
    {
      price: "🧺",
      payment_method: "💳",
      hours: "🕒",
      detergent: "🧼",
      coffee: "☕",
      photo: "📷",
      closed: "❌",
      moved: "📦",
      general: "📝",
    }[type] ?? "📝"
  );
}

function daysSince(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  );
}

/* Built by hand, UTC: toLocaleDateString differs between the server
   and the browser, which breaks hydration. */
function formatDay(iso: string) {
  const d = new Date(iso);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
