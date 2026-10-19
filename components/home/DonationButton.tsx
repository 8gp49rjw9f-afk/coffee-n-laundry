/*
 * THE DONATION BUTTON — one cup, two dollars, next to the menu.
 *
 * WHAT IT IS NOT
 *
 * Not a campaign, not a counter, not a “support us” banner. There is
 * no progress bar and no goal, because a goal that is not met is a
 * public failure and this is meant to be the opposite: a coffee that
 * somebody may buy if the map was useful, and nothing at all if it
 * was not.
 *
 * WHY IT SITS IN THE HEADER
 *
 * Because the header is where a person already looks for things to
 * do, and the alternative — a strip across the top of the page —
 * greets every visitor with a request before it has given them
 * anything. This is a door in the wall, not a hand held out.
 *
 * IT LEAVES THE SITE
 *
 * PayPal, in a new tab, with the amount already in the link. The
 * person is not navigated away from the page they were reading, and
 * nothing of theirs comes back here: no account, no email, no
 * payment detail. That is the whole reason to use a payment page
 * somebody else operates.
 *
 * THE AMOUNT IS IN THE URL
 *
 * `paypal.me/CoffeeNLaundry/2`. One number, in one place — see the
 * note in 0024_donations.sql for why there is no setting for it.
 *
 * WHY IT TAKES AN `enabled` FLAG AS WELL AS A URL
 *
 * An empty URL would already hide it, so the flag looks redundant.
 * It is not, for the case the whole feature is built around: the
 * first year ends, the button goes quiet, and the address stays in
 * the settings for the day it is wanted again. A switch that erases
 * what it switches is not a switch.
 */

export function DonationButton({
  url,
  amount = 2,
  className = "",
}: {
  /* The base address, from Admin → Site. The amount is appended.
     Empty or missing — no button at all. */
  url?: string | null;
  amount?: number;
  className?: string;
}) {
  const base = (url ?? "").trim().replace(/\/$/, "");

  if (!base) return null;

  return (
    <a
      href={`${base}/${amount}`}
      target="_blank"
      rel="noreferrer"
      title={`Buy coffee'n'laundry a coffee — $${amount}`}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 ${className}`}
    >
      <span className="text-base leading-none">☕</span>

      <span>{amount} $</span>
    </a>
  );
}

export default DonationButton;
