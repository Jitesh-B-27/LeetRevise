"use client";

export default function LibraryError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a12] px-6 text-slate-100">
      <section className="max-w-md rounded-3xl border border-rose-900/50 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/30">
        <p className="text-sm font-semibold text-rose-400">Library unavailable</p>
        <h1 className="mt-2 text-2xl font-bold text-white">We couldn’t load your problems.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Your saved data is untouched. Try the request again.</p>
        <button onClick={reset} className="mt-6 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-400">Try again</button>
      </section>
    </main>
  );
}
