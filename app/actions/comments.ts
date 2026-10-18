"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { displayNameFor } from "@/lib/database/places";

/* ====================================================== */
/* COMMENTS — one person, one short thing, once a day      */
/* ====================================================== */

/*
 * One comment per person per place per 24 hours.
 *
 * Admins are NOT exempt here, unlike reports (see 0020 and
 * reportPlace). A report is a signal that goes to a moderator and
 * has to be weighed; a comment is public text, and a moderator
 * posting six of them on their own place is exactly the thing the
 * ceiling exists to prevent. Everyone follows the same rule.
 *
 * The same moving 24-hour window as reports, for the same reason:
 * 23:59 and 00:01 are two minutes apart in reality and on different
 * days by the calendar. Counted backwards from now.
 *
 * AND AGAIN — A RETURNED RESULT, NOT A THROWN ERROR.
 *
 * godThe boundary rewrites a thrown message, so `throw new
 * Error("COMMENT_TOO_SOON")` would reach the browser as a generic
 * sentence the catalogue cannot recognise, and the person would see
 * "Something went wrong" with a reference to nothing. This is the
 * lesson reportPlace was rewritten to learn; the contract is now
 * `{ ok, code }` returned, as sendContact already did.
 */

const COMMENT_WINDOW_HOURS = 24;

/* Matches the CHECK constraint in 0021. Enforced in the database
   too, so a form that is bypassed cannot write a novel — but the
   number lives here as well, because refusing before the round trip
   is kinder than refusing after it. NOT a word count: the field
   says "keep it short" and nothing else. */
const MAX_LENGTH = 200;

export interface CommentResult {
  ok: boolean;
  code?: string;
}

export async function writeComment(formData: FormData): Promise<CommentResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "COMMENT_SIGNED_OUT" };
  }

  const placeId = String(formData.get("place_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!placeId || !body) {
    return { ok: false, code: "COMMENT_EMPTY" };
  }

  if (body.length > MAX_LENGTH) {
    return { ok: false, code: "COMMENT_TOO_LONG" };
  }

  /*
   * The window. `limit(1)` rather than a count: the question is
   * whether a comment exists in the last 24 hours, not how many.
   *
   * The index this reads is place_comments_recent_idx, added in
   * 0021 for exactly this query — one person, one place, newest
   * first — so the check does not scan the table.
   */
  const since = new Date(
    Date.now() - COMMENT_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recent, error: readError } = await supabase
    .from("place_comments")
    .select("id")
    .eq("place_id", placeId)
    .eq("user_id", user.id)
    .gte("created_at", since)
    .limit(1);

  if (readError) {
    /* Almost always the table missing: 0021 is in the repository
       and NOT applied to the database until someone pastes it into
       the Supabase SQL editor. Said out loud in the logs, because
       this is the recurring failure on this project and the code
       for it below is the one that tells a human where to look. */
    console.error("[writeComment] read", readError.message, readError.code);

    if (readError.code === "42P01") {
      return { ok: false, code: "COMMENT_NOT_READY" };
    }

    return { ok: false, code: "COMMENT_FAILED" };
  }

  if (recent && recent.length > 0) {
    return { ok: false, code: "COMMENT_TOO_SOON" };
  }

  /* The username, never the local part of an email — the same rule
     the field checks follow. Kept on the row as well as the id, so
     removing a user does not empty their comment. */
  const authorName = await displayNameFor(user.id);

  const { error } = await supabase.from("place_comments").insert({
    place_id: placeId,
    user_id: user.id,
    author_name: authorName,
    body,
  });

  if (error) {
    console.error("[writeComment] insert", error.message, error.code);

    /* The window check above can be raced by two taps a second
       apart. Nothing in the schema is unique on purpose, so this
       is not 23505 — but a failure here is still "try again",
       not a crash. */
    return {
      ok: false,
      code: error.code === "23514" ? "COMMENT_TOO_LONG" : "COMMENT_FAILED",
    };
  }

  revalidatePath(`/place/${placeId}`);

  return { ok: true };
}
