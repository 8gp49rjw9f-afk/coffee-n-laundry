"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/browser";
import { DonationButton } from "@/components/home/DonationButton";

/*
 * THE MARK — drawn here as SVG, not the PNG from `public/logo.png`.
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
 * SIZE. 48 px in the header, set at the call site below.
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
 * THE MENU, IN THE ORDER IT WAS ASKED FOR
 *
 *   Menu                      ← a title, centred, with no links of its own
 *   ─────
 *   Me [username]             ← signed in
 *   Admin                     ← master only
 *   ☕ 2 $ — buy us a coffee!  ← only when the address is set
 *   ─────
 *   Add a place
 *   Map
 *   ─────
 *   The goal
 *   ─────
 *   Report a bug
 *   Reach us
 *   ─────
 *   Log out / Log in · Sign up
 *
 * WHY THE GROUPS ARE SEPARATE AND NOT ONE LIST
 *
 * The rules are not decoration: they are what makes the menu readable
 * in one glance. The top block is YOU (who you are, what you may do,
 * and the coffee); the next is the site itself; then what it promises;
 * then how to reach us; then the session. A single undivided column of
 * thirteen rows is a list, not a menu.
 *
 * PRICING IS NOT IN THIS MENU, on purpose.
 *
 * `/pricing` still exists and still renders — the page and the credit
 * system behind it are untouched. What went away is the row in the
 * hamburger.
 *
 * THREE RULES THAT CANNOT ALL SHOW AT ONCE
 *
 *   signed in  → Me, Admin (if master), Log out
 *   signed out → Log in, Sign up
 *
 * Nothing is drawn for a state that is not current, so the menu is
 * never longer than it needs to be and never offers a door that is
 * already open.
 */

const SITE = [
  { href: "/new", label: "Add a place", emoji: "➕" },
  { href: "/", label: "Map", emoji: "🗺️" },
];

/*
 * `Pricing` used to be the second row here. It is commented out rather
 * than deleted so the intent is legible to whoever opens this file
 * next: the page is alive, the menu simply does not point at it.
 */
const ABOUT = [
  { href: "/goal", label: "The goal", emoji: "🎯" },
  /* { href: "/pricing", label: "Pricing", emoji: "💵" }, */
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
  username = null,
  donationUrl = null,
  banned = false,
}: {
  signedIn: boolean;
  admin: boolean;
  username?: string | null;
  donationUrl?: string | null;
  /*
   * A suspended account still signs in and still reads the map. What
   * it cannot do is write anything, and without this banner the only
   * sign of that would be every form failing for no visible reason —
   * which reads as a broken site, not as a decision somebody made.
   *
   * The reason the admin typed is deliberately NOT shown here. It is
   * on the record for the admins, and the same sentence reaching an
   * innocent person banned by mistake is worse than saying nothing.
   */
  banned?: boolean;
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

  const group = (links: { href: string; label: string; emoji: string }[]) => (
    <>
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
      {/* Sticky, and above the bar: a suspended person scrolls, and a
          notice that scrolls away with them would be missed on the
          form they are about to fill in. */}
      {banned && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900 sm:px-8">
          <strong className="font-semibold">
            Your account is suspended.
          </strong>{" "}
          You can still read the map, but nothing you add will be recorded.
        </div>
      )}

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

          {/* THE COFFEE, on a wide screen only. */}
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
                <p className="px-4 pb-2 pt-1 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
                  Menu
                </p>

                <div className={divider} />

                {/* WHO YOU ARE — and what you may do. */}
                {signedIn && (
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className={item}
                  >
                    <span>👤 Me</span>

                    <span className="truncate text-slate-400">
                      [{username ?? "someone"}]
                    </span>
                  </Link>
                )}

                {admin && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className={item}
                  >
                    ⚙️ Admin
                  </Link>
                )}

                {donating && (
                  <DonationButton url={donationUrl} variant="row" />
                )}

                {(signedIn || admin || donating) && <div className={divider} />}

                {/* THE SITE ITSELF. */}
                {group(SITE)}

                <div className={divider} />

                {/* WHAT IT PROMISES. */}
                {group(ABOUT)}

                <div className={divider} />

                {/* HOW TO REACH US. */}
                {group(TALK_TO_US)}

                <div className={divider} />

                {/* THE SESSION — one side or the other, never both. */}
                {signedIn ? (
                  <LogOutButton className={item} />
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className={item}
                    >
                      Log in
                    </Link>

                    <Link
                      href="/signup"
                      onClick={() => setOpen(false)}
                      className={item}
                    >
                      Sign up
                    </Link>
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
