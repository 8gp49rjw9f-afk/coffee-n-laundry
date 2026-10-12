/*
 * ======================================================
 * ERROR CATALOGUE
 * ======================================================
 *
 * Every error a person can meet on this site, in one place.
 *
 * WHY THIS FILE EXISTS
 *
 * Before this, an error behaved five different ways depending on
 * where it happened: a red banner in a form, a bare word inside a
 * button ("failed"), a grey line under a redeem button, or — for
 * anything that broke inside a Server Component — nothing at all.
 * Next.js replaces those with "An error occurred in the Server
 * Components render", which tells a visitor nothing and tells me
 * nothing either.
 *
 * Worse, fourteen places passed a raw Postgres message straight to
 * the screen. Someone could read `duplicate key value violates
 * unique constraint "place_reports_..._key"` and have no idea what
 * they were supposed to do about it.
 *
 * HOW IT WORKS
 *
 *   - A server action throws an Error whose message is a code:
 *     `throw new Error("PLACE_NAME_REQUIRED")`.
 *   - Something catches it — a component, or an app/error.tsx
 *     boundary — and hands the string to `describeError`.
 *   - `describeError` returns a title, a sentence in plain English,
 *     and a short reference.
 *
 * The raw message is NEVER shown. If a string arrives that is not a
 * known code, it is treated as an unknown fault and the visitor gets
 * the generic text plus a reference. That is what closes the leaks:
 * a Postgres message reaching a screen becomes impossible, because
 * the only strings that have a translation are the ones listed here.
 *
 * THE REFERENCE
 *
 * A short code, derived from the error, shown small under the
 * message. It is for the person to quote when they write to us, and
 * for finding the line in the logs. It is stable for the same error
 * and different between different ones.
 */

export type ErrorSeverity = "blocking" | "warning" | "muted";

export interface ErrorCopy {
  /** Short headline. What went wrong, in three or four words. */
  title: string;

  /** One sentence of plain English. What happened, and what to do. */
  body: string;

  /**
   * blocking — the action did not happen. Red.
   * warning  — it happened, but something was lost on the way. Amber.
   * muted    — a quiet notice. Grey, and it should not demand a click.
   */
  severity: ErrorSeverity;

  /** Offer a retry button. Only where retrying could actually help. */
  retry?: boolean;
}

/*
 * The catalogue.
 *
 * Keys are the codes the server throws. Keeping them UPPER_SNAKE
 * means a typo is visible at a glance in code review, and means a
 * code can never be confused with a sentence.
 *
 * THESE STRINGS ARE THE PRODUCT'S VOICE. They were written by hand,
 * one at a time, and a pass that rewrote them all at once flattened
 * them into one neutral register: "A position is needed" in place of
 * "It has to go on the map". The original wording was restored in
 * full. Treat a bulk edit of this block as a product decision, not a
 * tidy-up.
 *
 * The severity matters as much as the words. A place whose PRICES
 * were refused is still on the map — that is a `warning`, not a
 * blockage, and painting it red tells the person their place was
 * lost when it was not.
 */
export const ERROR_COPY: Record<string, ErrorCopy> = {
  /* ---------- signing in and accounts ---------- */
  AUTH_MISSING_FIELDS: {
    title: "Fill in both fields",
    body: "An email address and a password are needed to sign in.",
    severity: "blocking",
  },
  AUTH_INVALID_CREDENTIALS: {
    title: "Those do not match",
    body: "The email and password do not go together. Check them and try again.",
    severity: "blocking",
    retry: true,
  },
  AUTH_REGISTRATIONS_CLOSED: {
    title: "Registrations are closed",
    body: "New accounts are not being created at the moment.",
    severity: "blocking",
  },
  AUTH_PASSWORD_TOO_SHORT: {
    title: "That password is too short",
    body: "Use at least 8 characters.",
    severity: "blocking",
    retry: true,
  },
  AUTH_SIGNUP_FAILED: {
    title: "Could not create the account",
    body: "That address may already have an account. Try signing in instead.",
    severity: "blocking",
  },

  /* ---------- usernames ---------- */
  USERNAME_SHAPE: {
    title: "That name will not work",
    body: "Three to ten characters, using letters, numbers, hyphen or underscore.",
    severity: "blocking",
    retry: true,
  },
  USERNAME_TAKEN: {
    title: "That name is taken",
    body: "Somebody else has it. Try another one.",
    severity: "blocking",
    retry: true,
  },
  USERNAME_ALREADY_CHANGED: {
    title: "Already changed once",
    body: "A username can only be changed once. Write to us if there is a problem with yours.",
    severity: "blocking",
  },

  /* ---------- passwords and recovery ---------- */
  RESET_EMAIL_MISSING: {
    title: "An address is needed",
    body: "Enter the email you signed up with.",
    severity: "blocking",
  },
  RESET_EMAIL_FAILED: {
    title: "Could not send the link",
    body: "Try again in a moment. If it keeps failing, write to us.",
    severity: "blocking",
    retry: true,
  },
  RESET_LINK_EXPIRED: {
    title: "That link has expired",
    body: "Recovery links only work once, and only for a short while. Ask for a new one.",
    severity: "blocking",
  },
  RESET_PASSWORDS_DIFFER: {
    title: "The passwords do not match",
    body: "Type the same password in both fields.",
    severity: "blocking",
    retry: true,
  },
  RESET_FAILED: {
    title: "Could not save the password",
    body: "Try again, or ask for a fresh link.",
    severity: "blocking",
    retry: true,
  },

  /* ---------- adding a place ---------- */
  PLACE_NAME_REQUIRED: {
    title: "The place needs a name",
    body: "Even a rough one — someone else can correct it later.",
    severity: "blocking",
    retry: true,
  },
  /*
   * Thrown by the server guard in createPlace: a place with no photo
   * is not one anyone can judge, so the save is refused. Added after
   * the rest of this block was written, and worded to match it.
   */
  PLACE_PHOTO_REQUIRED: {
    title: "It needs a photo",
    body: "One picture of the place, and it can go on the map.",
    severity: "blocking",
    retry: true,
  },
  PLACE_NAME_TOO_LONG: {
    title: "That name is too long",
    body: "Shorten it a little and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_DESCRIPTION_TOO_LONG: {
    title: "Those notes are too long",
    body: "Trim them down and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_POSITION_REQUIRED: {
    title: "It has to go on the map",
    body: "Use the location picker to set where the place is.",
    severity: "blocking",
    retry: true,
  },
  PLACE_POSITION_INVALID: {
    title: "That position is off the map",
    body: "Pick the spot again with the location picker.",
    severity: "blocking",
    retry: true,
  },
  PLACE_DAILY_LIMIT: {
    title: "That is a lot for one day",
    body: "You have added as many places as one person can today. Try again tomorrow, or improve an existing one.",
    severity: "warning",
  },
  PLACE_SAVE_FAILED: {
    title: "Could not save the place",
    body: "Nothing was lost — your answers are still in the form. Try again.",
    severity: "blocking",
    retry: true,
  },
  /*
   * The place itself is saved; only its details were not. These four
   * are warnings on purpose — the pin is already on the map, and
   * colouring them red would say the opposite.
   */
  PLACE_COFFEE_DETAILS_REFUSED: {
    title: "Saved, but the coffee details were not",
    body: "The place is on the map, but the coffee facts did not stick. Open it and add them again.",
    severity: "warning",
  },
  PLACE_LAUNDRY_DETAILS_REFUSED: {
    title: "Saved, but the machine details were not",
    body: "The place is on the map, but the laundry facts did not stick. Open it and add them again.",
    severity: "warning",
  },
  PLACE_CHECKS_REFUSED: {
    title: "Saved, but the details were not recorded",
    body: "The place is on the map. The per-field notes about who verified what were refused.",
    severity: "warning",
  },
  PLACE_PRICES_REFUSED: {
    title: "Saved without the prices",
    body: "The place is on the map, but the prices did not stick. Open it and add them again.",
    severity: "warning",
  },
  PLACE_NOT_FOUND: {
    title: "That place is gone",
    body: "It may have been removed since the page was opened.",
    severity: "blocking",
  },

  /* ---------- editing a place ---------- */
  UPDATE_DAILY_LIMIT_COFFEE: {
    title: "One coffee shop a day",
    body: "You already edited a coffee shop today. You can edit another tomorrow.",
    severity: "blocking",
  },
  UPDATE_DAILY_LIMIT_LAUNDRY: {
    title: "One laundromat a day",
    body: "You already edited a laundromat today. You can edit another tomorrow.",
    severity: "blocking",
  },
  UPDATE_SAVE_FAILED: {
    title: "Could not save those changes",
    body: "Your edits are still in the form. Try again.",
    severity: "blocking",
    retry: true,
  },
  UPDATE_COFFEE_DETAILS_FAILED: {
    title: "Could not save the coffee details",
    body: "The rest of your changes may not have been saved either. Try again.",
    severity: "blocking",
    retry: true,
  },
  UPDATE_LAUNDRY_DETAILS_FAILED: {
    title: "Could not save the machine details",
    body: "The rest of your changes may not have been saved either. Try again.",
    severity: "blocking",
    retry: true,
  },

  /* ---------- photos ---------- */
  PHOTO_SIGNED_OUT: {
    title: "Sign in first",
    body: "An account is needed to add or change a photo.",
    severity: "blocking",
  },
  PHOTO_NONE_ATTACHED: {
    title: "No photo chosen",
    body: "Pick an image and try again.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_TOO_LARGE: {
    title: "That photo is too large",
    body: "The limit is 10 MB. A smaller version of the same picture will do.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_BAD_FORMAT: {
    title: "That file is not an image",
    body: "JPEG, PNG, WebP, GIF and HEIC are accepted.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_PROCESS_FAILED: {
    title: "Could not process that photo",
    body: "Try a smaller one, or take a new picture.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_UPLOAD_FAILED: {
    title: "Could not upload the photo",
    body: "Check your connection and try again.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_DELETE_DENIED: {
    title: "That photo is not yours to remove",
    body: "Only the person who added a photo, or the person who added the place, can delete it.",
    severity: "blocking",
  },
  PHOTO_ALREADY_GONE: {
    title: "That photo is already gone",
    body: "Someone may have removed it a moment ago.",
    severity: "muted",
  },
  PHOTO_COVER_FAILED: {
    title: "Could not set the cover",
    body: "The previous cover has been kept. Try again.",
    severity: "warning",
    retry: true,
  },
  PHOTO_REPLACE_DENIED: {
    title: "That photo is not yours to change",
    body: "Only the person who added a photo, or the person who added the place, can change it.",
    severity: "blocking",
  },

  /* ---------- verifying and reporting ---------- */
  VERIFY_SIGNED_OUT: {
    title: "Sign in first",
    body: "An account is needed to confirm what is still true.",
    severity: "blocking",
  },
  VERIFY_ALREADY_THIS_WEEK: {
    title: "You already checked this",
    body: "One check per field per week — that is what keeps the dates meaningful. Come back in a few days.",
    severity: "warning",
  },
  VERIFY_FAILED: {
    title: "Could not record that check",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  REPORT_REASON_REQUIRED: {
    title: "Tell us what is wrong",
    body: "A short reason is needed before the report can be sent.",
    severity: "blocking",
    retry: true,
  },
  REPORT_FAILED: {
    title: "Could not send the report",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  REPORT_ALREADY_SENT: {
    title: "You already reported this",
    body: "One report per person. An admin will look at it.",
    severity: "muted",
  },

  /* ---------- credits and subscription ---------- */
  CREDITS_SIGNED_OUT: {
    title: "Sign in first",
    body: "An account is needed for this.",
    severity: "blocking",
  },
  CREDITS_NOT_ENOUGH: {
    title: "Not enough credits yet",
    body: "Keep contributing — every price and photo adds up.",
    severity: "warning",
  },
  CREDITS_REDEEM_FAILED: {
    title: "Could not redeem right now",
    body: "Nothing was spent from your balance. Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  /*
   * A quiet one: creditRules answers {} when the rules table cannot
   * be read, which means contributions quietly stop earning. Nobody
   * is blocked and nothing is lost, so this is a line rather than a
   * demand for attention.
   */
  CREDITS_UNAVAILABLE: {
    title: "Credits are paused",
    body: "Contributions are being saved, but the credit rules could not be read just now. Your work is not lost.",
    severity: "muted",
  },

  /* ---------- contact ---------- */
  CONTACT_EMPTY: {
    title: "Write something first",
    body: "Even a sentence helps.",
    severity: "blocking",
    retry: true,
  },
  CONTACT_TOO_LONG: {
    title: "That message is too long",
    body: "Keep it under 2000 characters.",
    severity: "blocking",
    retry: true,
  },
  CONTACT_NOT_CONFIGURED: {
    title: "The form is not wired up",
    body: "This deployment cannot send mail yet. Reach the admins another way.",
    severity: "blocking",
  },
  CONTACT_NO_RECIPIENT: {
    title: "Nobody to send it to",
    body: "There is no admin address configured for this site yet.",
    severity: "blocking",
  },
  CONTACT_SEND_FAILED: {
    title: "Could not send that",
    body: "Your message was not lost — copy it somewhere if it matters and try again in a moment.",
    severity: "blocking",
    retry: true,
  },

  /* ---------- admin ---------- */
  ADMIN_ONLY: {
    title: "That page is for admins",
    body: "Your account does not have access to it.",
    severity: "blocking",
  },
  MASTER_ONLY: {
    title: "Master account only",
    body: "Only the master account can change who the admins are.",
    severity: "blocking",
  },
  ADMIN_SETTINGS_MISSING: {
    title: "Site settings are missing",
    body: "The settings row is not in the database. Nothing can be saved until it is restored.",
    severity: "blocking",
  },
  ADMIN_SETTINGS_SAVE_FAILED: {
    title: "Could not save the settings",
    body: "Nothing was changed. Try again.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_RULE_SAVE_FAILED: {
    title: "Could not save that rule",
    body: "Nothing was changed. Try again.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_EMAIL_INVALID: {
    title: "That is not an email address",
    body: "Check it and try again.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_ALREADY_ADMIN: {
    title: "Already an admin",
    body: "That address is on the list.",
    severity: "warning",
  },
  ADMIN_SELF_REMOVE: {
    title: "You cannot remove yourself",
    body: "A panel that can lock out its last key holder is a trap, so this is refused.",
    severity: "blocking",
  },
  ADMIN_MASTER_REMOVE: {
    title: "A master cannot be removed",
    body: "Only the master account can change the admin list.",
    severity: "blocking",
  },
  ADMIN_REMOVE_FAILED: {
    title: "Could not remove that admin",
    body: "Nothing was changed. Try again.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_PLACE_UPDATE_FAILED: {
    title: "Could not change the place",
    body: "The place is unchanged. Try again.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_REPORTS_CLOSE_FAILED: {
    title: "Could not close those reports",
    body: "The place may have changed, but the reports are still open. Try again.",
    severity: "warning",
    retry: true,
  },
  ADMIN_RESTORE_FAILED: {
    title: "Could not restore the place",
    body: "It is still in its current state. Try again.",
    severity: "blocking",
    retry: true,
  },

  /* ---------- reading a page ---------- */
  PAGE_MAP_FAILED: {
    title: "The map did not load",
    body: "The rest of the site still works. Reload the page, or try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_PLACE_FAILED: {
    title: "Could not load this place",
    body: "Reload the page, or try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_FORM_FAILED: {
    title: "The form did not load",
    body: "Nothing was lost — nothing had been sent yet. Reload the page.",
    severity: "blocking",
    retry: true,
  },
  PAGE_PROFILE_FAILED: {
    title: "Could not load your profile",
    body: "Reload the page, or try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_ADMIN_FAILED: {
    title: "The admin panel did not load",
    body: "Nothing is wrong with the data — the page itself failed. Reload it.",
    severity: "blocking",
    retry: true,
  },

  /* ---------- the catch-all ---------- */
  UNKNOWN: {
    title: "Something went wrong",
    body: "Nothing you did caused it, and it has been logged. Try again — and if it keeps happening, send us the reference below.",
    severity: "blocking",
    retry: true,
  },
};

export type ErrorCode = keyof typeof ERROR_COPY;

const KNOWN: Set<string> = new Set(Object.keys(ERROR_COPY));

/*
 * The same code, flattened.
 *
 * Next.js rewrites an error message on its way through an error
 * boundary, and the rewrite removes the underscores:
 * PLACE_NAME_TOO_LONG arrives as PLACENAMETOOLONG. Compared
 * literally against the code in this file, it matches nothing, the
 * visitor gets the generic copy, and the real fault is invisible —
 * which is exactly what a "Ref. BEEF" on a too-long name was.
 *
 * Both sides are flattened before they are compared, so a code
 * survives the trip whichever form it arrives in.
 */
function flatten(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

const KNOWN_FLAT: Set<string> = new Set(
  Object.keys(ERROR_COPY).map(flatten)
);

/**
 * Does this string name an error we have written copy for?
 *
 * A plain boolean, deliberately — NOT `value is ErrorCode`.
 *
 * Returning a type predicate arms the narrowing machinery: after a
 * failed check TypeScript excludes every string literal in that
 * union from the value, and since the union is made only of
 * literals, the value collapses to `never`. The build then refuses
 * the very next method call on it — "Property 'includes' does not
 * exist on type 'never'" — which is exactly what happened twice.
 *
 * Nothing in this file needs the narrowing: the caller compares and
 * looks the code up by string. A boolean is the honest return type.
 */
export function isErrorCode(value: string): boolean {
  return KNOWN.has(value);
}

/**
 * The code this string names, or null.
 *
 * An exact match is tried first — that is the normal case, and it is
 * free. Then the flattened form, which is what catches a message
 * Next.js has rewritten. Exact-first matters as well as correct:
 * flattening alone would let one code be found inside another by
 * iteration order.
 */
function matchCode(value: string): string | null {
  const text = value.trim();

  if (KNOWN.has(text)) return text;

  if (KNOWN_FLAT.has(flatten(text))) {
    for (const code of KNOWN) {
      if (flatten(code) === flatten(text)) return code;
    }
  }

  return null;
}

/**
 * The thrown marker. Server actions throw `new Error(code)`.
 *
 * The code is the whole message. Nothing else belongs in there — a
 * Postgres string in the same place is exactly the leak this file
 * exists to stop.
 */
export function throwCode(code: ErrorCode): never {
  throw new Error(code);
}

/*
 * A stable short reference, derived from the code.
 *
 * Four hex characters. Two different codes will collide eventually —
 * with a few hundred of them, a four-character space is plenty for
 * telling apart the handful a single person meets, and a collision
 * costs nothing: the reference is a hint for finding the line, and
 * the code itself is in the logs beside it.
 */
export function referenceFor(code: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return ((hash >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export interface DescribedError {
  code: string;
  title: string;
  body: string;
  severity: ErrorSeverity;
  retry: boolean;
  reference: string;
}

/**
 * Turn anything thrown into something a person can read.
 *
 * Four inputs, one shape:
 *
 *   - a known code            → its copy, and a reference.
 *   - a known code with its
 *     underscores stripped by
 *     Next.js                 → the same copy. (See `flatten`.)
 *   - a code embedded in a
 *     longer sentence         → that code's copy.
 *   - anything else           → the generic copy. The raw text is
 *                               dropped, deliberately, and only the
 *                               reference is shown.
 */
export function describeError(thrown: unknown): DescribedError {
  const raw =
    typeof thrown === "string"
      ? thrown
      : thrown instanceof Error
        ? thrown.message
        : "";

  const text = raw.trim();

  /* An exact code, which is the normal case — or one that arrived
     with its underscores stripped, which still names itself. */
  const direct = matchCode(text);

  if (direct) {
    const copy = ERROR_COPY[direct];

    return {
      code: direct,
      title: copy.title,
      body: copy.body,
      severity: copy.severity,
      retry: Boolean(copy.retry),
      reference: referenceFor(direct),
    };
  }

  /*
   * A code embedded in a longer sentence. Server action errors can
   * arrive wrapped, so the code is searched for rather than assumed
   * to be the whole string. Both sides flattened, for the same
   * reason as above.
   */
  for (const code of KNOWN) {
    if (flatten(text).includes(flatten(code))) {
      const copy = ERROR_COPY[code];

      return {
        code,
        title: copy.title,
        body: copy.body,
        severity: copy.severity,
        retry: Boolean(copy.retry),
        reference: referenceFor(code),
      };
    }
  }

  /* Nothing recognisable. Say nothing about what it was. */
  const copy = ERROR_COPY.UNKNOWN;

  return {
    code: "UNKNOWN",
    title: copy.title,
    body: copy.body,
    severity: copy.severity,
    retry: Boolean(copy.retry),
    reference: referenceFor(text || "unknown"),
  };
}

/*
 * What the server logs should say.
 *
 * A reference is useless on its own — it has to be findable. Every
 * caught error is logged with the reference, so a bug report
 * carrying "Ref. 4F2A" leads straight to the line that threw.
 */
export function logError(context: string, thrown: unknown): void {
  const described = describeError(thrown);

  console.error(
    `[${context}] ${described.code} (Ref. ${described.reference}):`,
    thrown instanceof Error ? thrown.message : thrown
  );
}
