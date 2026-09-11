import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="max-w-xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          LeetRevise
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Turn solved problems into lasting patterns.
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          Your focused daily workspace for revisiting LeetCode problems.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}
