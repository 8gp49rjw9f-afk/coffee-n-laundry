export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      <div className="text-6xl">🧭</div>

      <h1 className="mt-6 text-3xl font-bold text-slate-900">Nothing here</h1>

      <p className="mt-3 text-slate-600">
        This place does not exist, or it was removed. The map is still out
        there.
      </p>

      <a
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-6 font-semibold text-white hover:bg-slate-800"
      >
        ← Back to the map
      </a>
    </main>
  );
}
