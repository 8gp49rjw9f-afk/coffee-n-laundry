import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* ACCOUNT AGE — how long an account has been open         */
/* ====================================================== */

/*
 * A NEW ACCOUNT CANNOT TOUCH ANYBODY ELSE'S WORK.
 *
 * The daily limits were already there — one edit per type per day,
 * one report per place per 24 hours, one comment per person per day —
 * and they do the job they were written for. What they do not do is
 * stop a patient person: a purpose-made account can edit one café and
 * one laundromat today, the same tomorrow, and the day after that,
 * indefinitely. Nothing anywhere asked how old the account was.
 *
 * So this does. Two thresholds, and they are not the same number on
 * purpose:
 *
 *   EDITING — seven days. Rewriting a place somebody else added is
 *   the damage worth waiting out: it changes what a stranger reads
 *   about a real business. A week is long enough that the account is
 *   either genuine or gave up, and short enough that a traveller who
 *   lands today and fixes a wrong price next week is not inconvenienced.
 *
 *   VERIFYING — one hour. Ticking a field or confirming a place is
 *   still open is a light gesture, and blocking it for a week would
 *   cost more than it protects. An hour still shuts out the account
 *   opened in the same sitting as the vandalism.
 *
 * WHAT THIS DOES NOT DO, SAID PLAINLY
 *
 * It does not stop an account that was created eight days ago. It
 * makes the damage slow and expensive rather than impossible. The
 * thing that would actually close the door is a lifetime ceiling per
 * account, which is a different piece of work — this is the part that
 * costs almost nothing and buys the most.
 *
 * It also does not touch ADMIN actions. An admin was appointed by a
 * master precisely so they could act; if the master trusts somebody
 * who signed up this morning, that is the master's call, and a clock
 * would only get in the way.
 *
 * WHERE THE AGE COMES FROM
 *
 * From Supabase Auth, not from a column we keep. `auth.users` has
 * the sign-up timestamp, it is the one that cannot be edited from
 * the application, and reading it costs one local lookup.
 */

export const EDIT_MIN_ACCOUNT_HOURS = 24 * 7;
export const VERIFY_MIN_ACCOUNT_HOURS = 1;

/*
 * How many hours ago this account was created.
 *
 * Returns null when the age cannot be established at all — an
 * unknown user, or a failure reading Auth. The callers below treat
 * null as "too new", which is the safe direction: a wrong refusal
 * on a brand-new account costs a message, a wrong permission lets
 * the damage through.
 */
export async function accountAgeHours(userId: string): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  /*
   * `auth.admin` needs the service role key. On a deployment that
   * does not have one, the call fails and every account reads as too
   * new — so there is a fallback below that costs a query on
   * `profiles`, which is readable with the ordinary client.
   */
  if (!error && data?.user?.created_at) {
    return hoursSince(data.user.created_at);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.created_at) {
    return hoursSince(String(profile.created_at));
  }

  return null;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

/*
 * May this account edit a place it did not add?
 *
 * `isOwner` is the whole point of the exception: the person who added
 * the place may correct it from the first minute. The rule is about
 * touching OTHER people's work, not about being new.
 */
export async function canEdit(
  userId: string,
  isOwner: boolean
): Promise<boolean> {
  if (isOwner) return true;

  const hours = await accountAgeHours(userId);

  return hours != null && hours >= EDIT_MIN_ACCOUNT_HOURS;
}

/* Tick a field, or confirm a place is still open. One hour. */
export async function canVerify(userId: string): Promise<boolean> {
  const hours = await accountAgeHours(userId);

  return hours != null && hours >= VERIFY_MIN_ACCOUNT_HOURS;
}

/*
 * Write a comment, or report a place. Seven days, same as editing —
 * a comment is public text that sits under somebody else's place for
 * everyone to read, which puts it in the same class as rewriting the
 * place itself. Decided, not defaulted.
 */
export async function canCommentOrReport(userId: string): Promise<boolean> {
  const hours = await accountAgeHours(userId);

  return hours != null && hours >= EDIT_MIN_ACCOUNT_HOURS;
}
