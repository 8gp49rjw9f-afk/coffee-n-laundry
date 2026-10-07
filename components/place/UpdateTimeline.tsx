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

/*
 * No comments, no likes: a plain record of what changed.
 *
 * Five rows, and the title says so. The count is real rather than
 * fixed — a place with two updates reads "2 last updates", because
 * "5 last updates" above two lines would be a lie about a place that
 * has barely been touched.
 *
 * When there are more than five, the card says how many it is not
 * showing. On a site whose whole point is telling you whether the
 * information is current, silently truncating a history would hide
 * exactly the thing someone came here to judge.
 */

export function UpdateTimeline({
  updates,
  confirmations,
  lastConfirmedAt,
  total,
}: {
  updates: TimelineUpdate[];
  confirmations: number;
  lastConfirmedAt: string | null;
  /*
   * How many updates exist in all. The list holds at most five; this
   * is what lets the card say so rather than pretending the five it
   * shows are the whole story. The place page already reads this for
   * the line at the bottom, so it costs no extra query.
   */
  total: number;
}) {
  const hidden = Math.max(0, total - updates.length);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {total > 5 ? "5 last updates" : `${total} last updates`}
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

      {hidden > 0 && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
          {hidden} earlier {hidden === 1 ? "update" : "updates"} not shown.
        </p>
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
