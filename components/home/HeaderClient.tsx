"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

/* A ring with a cup and a drum inside it. One colour via
   currentColor, quirky, not corporate. */

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
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="100" cy="100" r="86" stroke="currentColor" strokeWidth="9" />
        <circle cx="66" cy="104" r="17" fill="#6f4e37" />
        <circle cx="134" cy="104" r="17" fill="#0284c7" />
        <path
          d="M100 30 v38"
          stroke="currentColor"
          strokeWidth="9"
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

const ALWAYS = [
  { href: "/new", label: "Add a place", emoji: "➕" },
  { href: "/", label: "Map", emoji: "🗺️" },
  { href: "/about", label: "About", emoji: "📖" },
  { href: "/brief", label: "The brief", emoji: "📄" },
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

  /* The account block sits below a heavier rule, so the menu reads
     as two groups: where you can go, and who you are. */

  const divider = "my-2 border-t border-slate-300";

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={32} />
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
              <div className="absolute right-0 top-full mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                <p className="px-4 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Menu
                </p>

                {ALWAYS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={item}
                  >
                    {link.emoji} {link.label}
                  </Link>
                ))}

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
