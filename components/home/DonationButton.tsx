/*
 * THE DONATION BUTTON — one cup, two dollars, next to the menu.
 *
 * IT LEAVES THE SITE
 *
 * PayPal, in a new tab, with the amount already in the link. The
 * person is not navigated away from the page they were reading, and
 * nothing of theirs comes back here: no account, no email, no
 * payment detail.
 *
 * TWO LAYOUTS, ONE GUARD
 *
 * "chip" for the bar, "row" for the hamburger menu on a phone. An
 * earlier version wrote the menu's link out by hand at the call site,
 * and with an empty address it produced "/2" — a RELATIVE path — so a
 * tap landed on this site's own 404. Both layouts live here now, and
 * both go through the same check below.
 */

export function DonationButton({
  url,
  amount = 2,
  variant = "chip",
  className = "",
}: {
  /* The base address, from Admin → Site. The amount is appended.
     Empty, or not an absolute http(s) address — no button at all. */
  url?: string | null;
  amount?: number;
  /*
   * "chip" — the small amber button, for the bar.
   * "row"  — a line in the hamburger menu, for a phone.
   */
  variant?: "chip" | "row";
  className?: string;
}) {
  const base = (url ?? "").trim().replace(/\/$/, "");

  /*
   * TWO WAYS THIS COMES BACK EMPTY, and both must hide the button:
   *
   *   - no address at all, with the switch on and the field blank;
   *   - an address that is not absolute. This is the one that shipped
   *     broken: a partial value turned the menu's link into "/2", a
   *     relative path, so the browser asked OUR OWN site for a page
   *     called /2 and showed the 404. A setting half filled in must
   *     never produce a link that points back at us.
   *
   * Only http and https are accepted. No javascript:, no mailto:, no
   * relative path, no bare domain without a scheme.
   */
  const usable = /^https?:\/\/[^\s]+$/i.test(base);

  if (!base || !usable) return null;

  const href = `${base}/${amount}`;
  const title = `Buy coffee'n'laundry a coffee — $${amount}`;

  if (variant === "row") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={title}
        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-amber-900 transition hover:bg-amber-50 ${className}`}
      >
        ☕ {amount} $ — buy us a coffee
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 ${className}`}
    >
      <span className="text-base leading-none">☕</span>

      <span>{amount} $</span>
    </a>
  );
}

export default DonationButton;
