"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

/*
 * THE MARK — the real logo, from `public/logo.png`.
 *
 * NO BACKING PLATE. There was a dark disc behind this for one
 * commit, on the assumption that white artwork needs a dark ground.
 * That assumption was wrong twice over: the PNG is not white but
 * silver-grey with highlights, which reads fine on white — and the
 * disc was the same 32 px as the image while the artwork inside it
 * is inset with its own margin, so the visible result was a black
 * circle with a small mark somewhere in the middle. It looked like a
 * hole in the header.
 *
 * So the image sits straight on the bar.
 *
 * SIZE, AND WHAT THE PICTURE IS FOR
 *
 * The artwork carries the wordmark inside the ring, which is
 * legible at 1200 px and a smudge at 32. The wordmark BESIDE it is
 * what spells the name out; the picture is the mark. That division
 * is deliberate, not a compromise — a logo that has to be enlarged
 * to be readable stops being an icon.
 *
 * If the mark ever needs to be bigger, raise `size` on the Logo in
 * the header below. Nothing else depends on this number.
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
      <Image
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        priority
        className="shrink-0 object-contain"
      />

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
}: {
  signedIn: boolean;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
          <Logo size={40} />
        </Link>

        <div className="flex items-center gap-3">
          {!signedIn && (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Log in
            </Link>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
