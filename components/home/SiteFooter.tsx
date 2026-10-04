import Link from "next/link";

/*
 * A footer, not a menu.
 *
 * The hamburger already carries every link, so this is not here to
 * help navigation — it is here because the two things a frustrated
 * visitor wants (report a bug, reach a human) were hidden behind an
 * icon they had to guess. A footer is where people look when the page
 * has failed them.
 *
 * No server work: no session, no settings, no database. A footer that
 * costs a query is a footer that breaks the page it sits under.
 */

const LINKS = [
  { href: "/goal", label: "The goal" },
  { href: "/pricing", label: "Pricing" },
  { href: "/report-bug", label: "Report a bug" },
  { href: "/reach-us", label: "Reach us" },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <p className="text-xs text-slate-500">
          coffee&apos;n&apos;laundry — built by the people who use it.
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export default SiteFooter;
