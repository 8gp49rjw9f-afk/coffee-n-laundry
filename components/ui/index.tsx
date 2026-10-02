import clsx from "clsx";
import Link from "next/link";

export function Card({
  children,
  className,
  padding = "md",
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-white shadow-sm",
        {
          "p-0": padding === "none",
          "p-4": padding === "sm",
          "p-6": padding === "md",
          "p-8": padding === "lg",
          "transition-all duration-200 hover:-translate-y-1 hover:shadow-xl":
            hover,
        },
        className
      )}
    >
      {children}
    </div>
  );
}

/* Large targets: this gets used one-handed, outdoors. */
export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled = false,
  href,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "coffee" | "laundry" | "ghost" | "danger";
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = clsx(
    "inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    {
      "bg-slate-900 text-white hover:bg-slate-800": variant === "primary",
      "bg-[#6f4e37] text-white hover:bg-[#5d4130]": variant === "coffee",
      "bg-sky-600 text-white hover:bg-sky-700": variant === "laundry",
      "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50":
        variant === "ghost",
      "bg-rose-600 text-white hover:bg-rose-700": variant === "danger",
    },
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

/* 16px text on mobile prevents iOS from zooming the page. */
const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export function Input({
  label,
  hint,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          {label}
        </span>
      )}

      <input className={clsx(FIELD, className)} {...props} />

      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          {label}
        </span>
      )}

      <textarea className={clsx(FIELD, className)} {...props} />

      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-2xl bg-white p-5 shadow-sm", className)}>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h2>

      {children}
    </section>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
      {message}
    </p>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="text-5xl">{emoji}</div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>

      {body && <p className="mt-2 max-w-md text-sm text-slate-600">{body}</p>}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* The single most useful action on mobile. */
export function DirectionsButton({
  latitude,
  longitude,
  label = "Directions",
}: {
  latitude: number;
  longitude: number;
  label?: string;
}) {
  const href = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
    >
      🧭 {label}
    </a>
  );
}
