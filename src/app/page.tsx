import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070a12] px-6 text-slate-100">
      <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl" />
      <section className="relative max-w-2xl text-center">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-blue-400">
          LeetRevise
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Turn solved problems into lasting patterns.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-400">
          Your focused daily workspace for revisiting LeetCode problems.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-blue-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-2.5 font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}
