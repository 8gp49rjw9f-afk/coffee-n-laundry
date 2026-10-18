"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";

import { writeComment } from "@/app/actions/comments";

import { showError } from "@/components/ui/ErrorPopup";

/*
 * COMMENTS — the panel that replaced “Last 5 updates”.
 *
 * WHY THE TIMELINE WENT
 *
 * The old panel listed what CHANGED: a price that moved, a field
 * somebody confirmed, a place reported closed. All of that already
 * appears where it belongs — the “was 6$” line sits under the price
 * it refers to, and the count of confirmations is right here. A
 * separate five-row history said the same things a second time, in
 * a place someone had to scroll to, and it grew stale between
 * visits. What was missing was not a record but a voice.
 *
 * THE DATE UNDER THE BUTTON is the one fact from that panel worth
 * keeping, and the place header renders it.
 *
 * THE RULE: once per person, per place, per 24 hours.
 *
 * Enforced in writeComment, not here and not in an index — a moving
 * window cannot be an index, which is the lesson 0020 wrote down
 * for reports. This component only REFLECTS the rule: if the person
 * has already written today, the field gives way to a line saying
 * so, because offering a form that will be refused is worse than
 * not offering one.
 *
 * A comment is short on purpose. 200 characters, and the counter
 * below only appears when someone is within reach of the limit —
 * nobody should be counting while they type a sentence.
 */

export interface PlaceComment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const MAX_LENGTH = 200;

/* Hand-built, in UTC: toLocaleDateString differs between the server
   and the browser, which breaks hydration. */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDay(iso: string) {
  const d = new Date(iso);

  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* How long ago, in the same voice as the verification dates on the
   rest of the page — not a raw timestamp. */
function since(iso: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  );

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.round(days / 30);

  if (months <= 1) return "a month ago";
  if (months < 24) return `${months} months ago`;

  const years = Math.round(months / 12);

  return years <= 1 ? "a year ago" : `${years} years ago`;
}

export function CommentSection({
  placeId,
  comments,
  signedIn,
  writtenToday,
  confirmations,
  lastConfirmedAt,
}: {
  placeId: string;
  comments: PlaceComment[];
  signedIn: boolean;
  /* Read on the server: has THIS person already commented on THIS
     place in the last 24 hours. */
  writtenToday: boolean;
  confirmations: number;
  lastConfirmedAt: string | null;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const remaining = MAX_LENGTH - body.length;

  async function submit() {
    const text = body.trim();

    if (!text || loading) return;

    setLoading(true);

    const formData = new FormData();
    formData.set("place_id", placeId);
    formData.set("body", text);

    const result = await writeComment(formData);

    setLoading(false);

    if (!result.ok) {
      /* No try/catch: the action returns, it does not throw. This
         is the contract reportPlace was rewritten to use, and the
         reason for it is written down there. A muted code — someone
         racing the window with two taps — still counts as done, so
         the field closes like a success. */
      const described = showError(result.code ?? "COMMENT_FAILED");

      if (described.severity === "muted") {
        setBody("");
        setSent(true);
      }

      return;
    }

    setBody("");
    setSent(true);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {comments.length === 0
            ? "Comments"
            : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
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

      {comments.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nobody has said anything about this place yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
            >
              <p className="text-sm font-semibold text-slate-900">
                <span className="text-slate-400">👤</span> @{comment.author_name}

                <span className="ml-2 text-xs font-normal text-slate-400">
                  {since(comment.created_at)}
                </span>
              </p>

              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        {!signedIn ? (
          <a
            href={`/login?next=/place/${placeId}`}
            className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Log in to comment
          </a>
        ) : sent || writtenToday ? (
          <p className="text-sm font-semibold text-emerald-700">
            Thanks ✓ — one comment per place per day.
          </p>
        ) : (
          <div className="space-y-2">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
              maxLength={MAX_LENGTH}
              placeholder="Say something useful about this place."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
            />

            <div className="flex items-center justify-between gap-3">
              /* The count appears only near the limit. Nobody should
                 be counting characters while writing one sentence. */
              <span className="text-xs text-slate-400">
                {remaining <= 40 ? `${remaining} left` : ""}
              </span>

              <button
                type="button"
                onClick={submit}
                disabled={loading || body.trim().length === 0}
                className="min-h-11 rounded-xl bg-slate-900 px-5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Post"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default CommentSection;
