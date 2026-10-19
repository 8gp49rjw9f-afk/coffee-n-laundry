"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/browser";
import { DonationButton } from "@/components/home/DonationButton";

/*
 * THE MARK — drawn here as SVG, not the PNG from `public/logo.png`.
 *
 * WHY WE STOPPED USING THE PNG
 *
 * The PNG carries the wordmark inside the ring. That is legible at
 * 1200 px and a smudge at 40 — so every attempt to read it up here
 * ended in either a bigger bar or an unreadable one. A raster mark
 * also softens on the retina scales a header gets rendered at.
 *
 * The SVG below is the same motif with the text left out: the ring,
 * the two dots (coffee brown, the blue), and the vertical stroke. It
 * is sharp at 12 px and at 512, holds at any device pixel ratio, and
 * costs a few hundred bytes instead of 324 KB.
 *
 * The wordmark BESIDE it is what spells the name out; the drawing is
 * the mark. That division is deliberate: a logo that has to be
 * enlarged to be readable stops being an icon.
 *
 * NO BACKING PLATE. There was a dark disc behind this for one
 * commit, on the assumption that white artwork needs a dark ground.
 * That assumption was wrong twice over: the artwork is not white but
 * silver-grey with highlights, which reads fine on white — and the
 * disc was the same size as the image while the artwork inside it is
 * inset with its own margin, so the visible result was a black circle
 * with a small mark somewhere in the middle. It looked like a hole in
 * the header. The mark sits straight on the bar.
 *
 * SIZE. 48 px in the header, set at the call site below. Nothing
 * else depends on the number: the SVG scales cleanly, so raising it
 * is a one-line change.
 *
 * Kept in step with `app/icon.svg`, which is the favicon of the same
 * motif. If the design changes, change both.
 */

export function Logo({
  size = 36,
  showWordmark = true,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center gap-2 text-slate-900 ${className}`}
      aria-label="coffee'n'laundry"
      role="img"
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="100" cy="100" r="86" stroke="#171717" strokeWidth="8" />
        <circle cx="66" cy="104" r="17" fill="#6f4e37" />
        <circle cx="134" cy="104" r="17" fill="#0284c7" />
        <path
          d="M100 30 v38"
          stroke="#171717"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>

      {showWordmark && (
        <span className="text-base font-bold leading-none sm:text-lg">
          coffee&apos;n&apos;laundry
        </span>
      )}
    </span>
  );
}

/*
 * Three groups, divided by rules: where you go, what you can tell us,
 * and who you are. The order matters — the map and adding a place come
 * first because they are what the site is for.
 */

const GO_PLACES = [
  { href: "/new", label: "Add a place", emoji: "➕" },
  { href: "/", label: "Map", emoji: "🗺️" },
  { href: "/goal", label: "The goal", emoji: "🎯" },
  { href: "/pricing", label: "Pricing", emoji: "💵" },
];

const TALK_TO_US = [
  { href: "/report-bug", label: "Report a bug", emoji: "🐞" },
  { href: "/reach-us", label: "Reach us", emoji: "✉️" },
];

/* Log out clears the session twice on purpose: the browser client
   holds its own copy, the server holds the cookies. */

function LogOutButton({ className }: { className: string }) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* The server side below still runs either way. */
    }

    window.location.href = "/signout";
  }

  return (
    <button type="button" onClick={handle} disabled={busy} className={className}>
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}

export default function HeaderClient({
  signedIn,
  admin,
  donationUrl = null,
}: {
  signedIn: boolean;
  admin: boolean;
  /*
   * The donation address, from Admin → Site. Null — or empty, or a
   * missing column before 0024 is applied — means no button at all.
   *
   * It arrives as a prop rather than being read here because this is
   * a client component and the setting lives in the database: the
   * server reads it once per request, in app/layout.tsx, and passes
   * it down. Nothing about the button is fetched in the browser.
   */
  donationUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const donating = Boolean((donationUrl ?? "").trim());

  /* Click outside closes it. */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* Escape closes it too. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* The session changed under us — close, so the menu is never stale. */
  useEffect(() => {
    setOpen(false);
  }, [signedIn, admin]);

  const item =
    "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

  const divider = "my-2 border-t border-slate-300";

  const group = (label: string, links: { href: string; label: string; emoji: string }[]) => (
    <>
      <p className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={() => setOpen(false)}
          className={item}
        >
          {link.emoji} {link.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={48} />
        </Link>

        <div className="flex items-center gap-3">
          {!signedIn && (
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
            >
              Log in
            </Link>
          )}

          {/*
           * THE COFFEE, on a wide screen only.
           *
           * A phone header already carries the mark, the wordmark and
           * the hamburger, and a fourth control would start squeezing
           * the wordmark rather than fitting beside it. So on a narrow
           * screen the button moves into the menu instead — same
           * action, one tap further, and nothing overlapping.
           */}
          {donating && (
            <DonationButton url={donationUrl} className="hidden sm:inline-flex" />
          )}

          {/* HAMBURGER */}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
              aria-label="Menu"
              aria-expanded={open}
            >
              {open ? "✕" : "☰"}
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                {group("Menu", GO_PLACES)}

                <div className={divider} />

                {group("Tell us", TALK_TO_US)}

                <div className={divider} />

                {signedIn ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setOpen(false)}
                      className={item}
                    >
                      👤 Me
                    </Link>

                    {admin && (
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className={item}
                      >
                        ⚙️ Admin
                      </Link>
                    )}

                    <LogOutButton className={item} />
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      onClick={() => setOpen(false)}
                      className={item}
                    >
                      Sign up
                    </Link>

                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className={item}
                    >
                      Log in
                    </Link>
                  </>
                )}

                {/*
                 * The coffee again, on a phone only — see the note
                 * above the wide-screen copy.
                 *
                 * THE SAME COMPONENT, not a second copy of the link.
                 * The first version wrote the href out by hand here,
                 * and with an empty address it produced "/2" — a
                 * relative path — so a tap landed on this site's own
                 * 404. One component means one guard, and the two
                 * layouts cannot drift apart again.
                 */}
                {donating && (
                  <>
                    <div className={divider} />

                    <DonationButton url={donationUrl} variant="row" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
