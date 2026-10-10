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
 * A short code, derived from the error code itself. It is a hint for
 * finding the line, not a secret: it appears on screen and in the
 * logs together, so "Ref. 4F2A" leads to the error that threw.
 */

export type ErrorSeverity = "blocking" | "warning" | "muted";

export interface ErrorCopy {
  title: string;
  body: string;
  severity: ErrorSeverity;
  retry?: boolean;
}

/*
 * Keyed by the code a server action throws. The strings are the whole
 * message, so they are compared literally against what arrives — see
 * the note on flattening further down before changing that.
 */
export const ERROR_COPY: Record<string, ErrorCopy> = {
  AUTH_MISSING_FIELDS: {
    title: "Something is missing",
    body: "Fill in every field and try again.",
    severity: "blocking",
    retry: true,
  },
  AUTH_INVALID_CREDENTIALS: {
    title: "That did not work",
    body: "The email and password do not match an account.",
    severity: "blocking",
    retry: true,
  },
  AUTH_REGISTRATIONS_CLOSED: {
    title: "Sign-ups are closed",
    body: "New accounts are not being taken right now.",
    severity: "blocking",
  },
  AUTH_PASSWORD_TOO_SHORT: {
    title: "That password is too short",
    body: "Use at least eight characters.",
    severity: "blocking",
    retry: true,
  },
  AUTH_SIGNUP_FAILED: {
    title: "We could not create the account",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  USERNAME_SHAPE: {
    title: "That username will not work",
    body: "Use letters, numbers, and underscores only.",
    severity: "blocking",
    retry: true,
  },
  USERNAME_TAKEN: {
    title: "That username is taken",
    body: "Try another one.",
    severity: "blocking",
    retry: true,
  },
  USERNAME_ALREADY_CHANGED: {
    title: "You have already changed it",
    body: "A username can be changed once. This account has used that.",
    severity: "blocking",
  },
  RESET_EMAIL_MISSING: {
    title: "An email is needed",
    body: "Enter the address on the account.",
    severity: "blocking",
    retry: true,
  },
  RESET_EMAIL_FAILED: {
    title: "We could not send that email",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  RESET_LINK_EXPIRED: {
    title: "That link has expired",
    body: "Ask for a new one and use it soon after it arrives.",
    severity: "blocking",
    retry: true,
  },
  RESET_PASSWORDS_DIFFER: {
    title: "The two passwords differ",
    body: "Type them again, matching.",
    severity: "blocking",
    retry: true,
  },
  RESET_FAILED: {
    title: "We could not reset the password",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PLACE_NAME_REQUIRED: {
    title: "A name is needed",
    body: "Give the place a name so people can find it.",
    severity: "blocking",
    retry: true,
  },
  /* Thrown by the server guard in createPlace: a place with no photo is
     not one anyone can judge, so the save is refused. */
  PLACE_PHOTO_REQUIRED: {
    title: "A photo is needed",
    body: "Add at least one photo of the place, then save it again.",
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
    title: "That description is too long",
    body: "Shorten it a little and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_POSITION_REQUIRED: {
    title: "A position is needed",
    body: "Place the pin on the map first.",
    severity: "blocking",
    retry: true,
  },
  PLACE_POSITION_INVALID: {
    title: "That position will not work",
    body: "Place the pin again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_DAILY_LIMIT: {
    title: "That is enough for today",
    body: "You can add more places tomorrow.",
    severity: "warning",
  },
  PLACE_SAVE_FAILED: {
    title: "We could not save the place",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PLACE_COFFEE_DETAILS_REFUSED: {
    title: "The coffee details were refused",
    body: "Check the fields and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_LAUNDRY_DETAILS_REFUSED: {
    title: "The laundry details were refused",
    body: "Check the fields and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_CHECKS_REFUSED: {
    title: "Some answers were refused",
    body: "Review the checks and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_PRICES_REFUSED: {
    title: "The prices were refused",
    body: "Check the amounts and try again.",
    severity: "blocking",
    retry: true,
  },
  PLACE_NOT_FOUND: {
    title: "That place is not here",
    body: "It may have been removed. Head back to the map.",
    severity: "muted",
  },
  UPDATE_DAILY_LIMIT_COFFEE: {
    title: "That is enough for today",
    body: "You can update coffee details again tomorrow.",
    severity: "warning",
  },
  UPDATE_DAILY_LIMIT_LAUNDRY: {
    title: "That is enough for today",
    body: "You can update laundry details again tomorrow.",
    severity: "warning",
  },
  UPDATE_SAVE_FAILED: {
    title: "We could not save the update",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  UPDATE_COFFEE_DETAILS_FAILED: {
    title: "The coffee details did not save",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  UPDATE_LAUNDRY_DETAILS_FAILED: {
    title: "The laundry details did not save",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_SIGNED_OUT: {
    title: "Sign in first",
    body: "Photos can only be added by signed-in people.",
    severity: "blocking",
  },
  PHOTO_NONE_ATTACHED: {
    title: "No photo was attached",
    body: "Choose a photo and try again.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_TOO_LARGE: {
    title: "That photo is too large",
    body: "Try one under the size limit.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_BAD_FORMAT: {
    title: "That format will not work",
    body: "Use a JPEG or a PNG.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_PROCESS_FAILED: {
    title: "We could not process that photo",
    body: "Try another one.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_UPLOAD_FAILED: {
    title: "The photo did not upload",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_DELETE_DENIED: {
    title: "That photo cannot be removed",
    body: "Only the person who added it can remove it.",
    severity: "blocking",
  },
  PHOTO_ALREADY_GONE: {
    title: "That photo is already gone",
    body: "Nothing to remove.",
    severity: "muted",
  },
  PHOTO_COVER_FAILED: {
    title: "We could not set the cover",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PHOTO_REPLACE_DENIED: {
    title: "That photo cannot be replaced",
    body: "Only the person who added it can replace it.",
    severity: "blocking",
  },
  VERIFY_SIGNED_OUT: {
    title: "Sign in first",
    body: "Verification needs an account.",
    severity: "blocking",
  },
  VERIFY_ALREADY_THIS_WEEK: {
    title: "Already verified this week",
    body: "Come back next week to verify again.",
    severity: "muted",
  },
  VERIFY_FAILED: {
    title: "We could not record that",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  REPORT_REASON_REQUIRED: {
    title: "A reason is needed",
    body: "Say briefly what is wrong with the place.",
    severity: "blocking",
    retry: true,
  },
  REPORT_FAILED: {
    title: "We could not send the report",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  REPORT_ALREADY_SENT: {
    title: "You have already reported this",
    body: "Reports are reviewed before anything changes.",
    severity: "muted",
  },
  CREDITS_SIGNED_OUT: {
    title: "Sign in first",
    body: "Credits belong to an account.",
    severity: "blocking",
  },
  CREDITS_NOT_ENOUGH: {
    title: "Not enough credits",
    body: "You need more to redeem that.",
    severity: "blocking",
  },
  CREDITS_REDEEM_FAILED: {
    title: "We could not redeem those",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  CREDITS_UNAVAILABLE: {
    title: "Credits are not available",
    body: "Redeeming is switched off right now.",
    severity: "muted",
  },
  CONTACT_EMPTY: {
    title: "The message is empty",
    body: "Write something first.",
    severity: "blocking",
    retry: true,
  },
  CONTACT_TOO_LONG: {
    title: "That message is too long",
    body: "Shorten it a little and try again.",
    severity: "blocking",
    retry: true,
  },
  CONTACT_NOT_CONFIGURED: {
    title: "Messages are not set up",
    body: "The contact form cannot send right now.",
    severity: "muted",
  },
  CONTACT_NO_RECIPIENT: {
    title: "Messages are not set up",
    body: "There is no address to send to right now.",
    severity: "muted",
  },
  CONTACT_SEND_FAILED: {
    title: "We could not send that message",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_ONLY: {
    title: "Admins only",
    body: "This account does not have that access.",
    severity: "blocking",
  },
  MASTER_ONLY: {
    title: "The owner only",
    body: "This account does not have that access.",
    severity: "blocking",
  },
  ADMIN_SETTINGS_MISSING: {
    title: "The settings are missing",
    body: "Nothing was found to save.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_SETTINGS_SAVE_FAILED: {
    title: "The settings did not save",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_RULE_SAVE_FAILED: {
    title: "The rule did not save",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_EMAIL_INVALID: {
    title: "That email will not work",
    body: "Check the address and try again.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_ALREADY_ADMIN: {
    title: "Already an admin",
    body: "That account already has access.",
    severity: "muted",
  },
  ADMIN_SELF_REMOVE: {
    title: "You cannot remove yourself",
    body: "Ask the owner to do it.",
    severity: "blocking",
  },
  ADMIN_MASTER_REMOVE: {
    title: "The owner cannot be removed",
    body: "That account is not removable.",
    severity: "blocking",
  },
  ADMIN_REMOVE_FAILED: {
    title: "That account was not removed",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_PLACE_UPDATE_FAILED: {
    title: "The place was not updated",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_REPORTS_CLOSE_FAILED: {
    title: "Those reports were not closed",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  ADMIN_RESTORE_FAILED: {
    title: "That was not restored",
    body: "Try again in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_MAP_FAILED: {
    title: "The map did not load",
    body: "Reload the page, or come back in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_PLACE_FAILED: {
    title: "That place did not load",
    body: "Reload the page, or come back in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_FORM_FAILED: {
    title: "The form did not load",
    body: "Reload the page, or come back in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_PROFILE_FAILED: {
    title: "The profile did not load",
    body: "Reload the page, or come back in a moment.",
    severity: "blocking",
    retry: true,
  },
  PAGE_ADMIN_FAILED: {
    title: "The admin page did not load",
    body: "Reload the page, or come back in a moment.",
    severity: "blocking",
    retry: true,
  },
  UNKNOWN: {
    title: "Something went wrong",
    body: "That was not expected. Try again, and if it keeps happening let us know with the reference below.",
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
