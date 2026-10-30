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
 * one at a time, and a pass that rewrote them together flattened
 * them into one neutral register. They have been restored in full
 * from the commit that first wrote them. Treat a bulk edit of this
 * block as a product decision, not a tidy-up.
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
  /* The same wall seen from the other door. Supabase answers the
     login with an "email not confirmed" error, which the action
     currently reads as a wrong password — so someone who mistyped
     nothing at all is told their credentials are wrong and retypes
     them until they give up. This names the real obstacle. */
  AUTH_EMAIL_NOT_CONFIRMED: {
    title: "Confirm your email first",
    body: "This account exists but the address has not been confirmed yet. Open the link we sent, then sign in. You can send it again from the sign-up page.",
    severity: "blocking",
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
  /*
   * The account exists, but nobody can use it yet. Supabase sends a
   * confirmation link at signup and holds the session back until the
   * link is opened — so the person who has just filled this form in
   * will be turned away at the login screen, and nothing on the site
   * told them why.
   *
   * A `warning` and not a `blocking`: nothing failed. The account was
   * created and the email is on its way. Painting it red would say
   * the signup did not work, which is exactly the misunderstanding
   * this copy exists to prevent.
   */
  AUTH_CONFIRM_EMAIL: {
    title: "Check your inbox",
    body: "We sent a confirmation link to that address. Open it and click the link — the account is not active until you do, and signing in will not work before then. Nothing after a few minutes? Look in the spam folder, or send the email again from the sign-up page.",
    severity: "warning",
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
    severity: "blocking",
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
