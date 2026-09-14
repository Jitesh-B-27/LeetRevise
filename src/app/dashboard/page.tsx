import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSubmissionLibraryService } from "@/lib/services/submission-library";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export default async function DashboardPage() {
  const userId = await requireAuthenticatedUser();
  const submissions = await createSubmissionLibraryService().list(userId);
  const latest = submissions[0];

  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-bold uppercase tracking-[0.18em] text-blue-400">LeetRevise</Link>
          <div className="flex items-center gap-5">
            <Link href="/library" className="text-sm font-semibold text-slate-400 hover:text-white">Library</Link>
            <form action={signOut}>
              <button type="submit" className="text-sm font-semibold text-slate-500 hover:text-white">Sign out</button>
            </form>
          </div>
        </nav>
        <header className="mt-16 max-w-2xl">
          <p className="text-sm font-semibold text-blue-400">Your workspace</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Keep every solve within reach.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-400">Your accepted solutions now have a home. Browse what you solved and return to the exact code you submitted.</p>
        </header>
        <section className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <Link href="/library" className="group relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-7 text-white shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-blue-500/40 sm:p-9">
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-6">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-100">PROBLEM LIBRARY</span>
                <span aria-hidden="true" className="text-2xl text-blue-300 transition group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-14 text-6xl font-bold tracking-tight">{submissions.length}</p>
              <h2 className="mt-2 text-xl font-semibold">{submissions.length === 1 ? "saved problem" : "saved problems"}</h2>
              <p className="mt-5 text-sm text-slate-300">{latest ? `Latest solve: ${latest.title} · ${formatDate(latest.submittedAt)}` : "Connect the extension and bring in your first accepted solution."}</p>
              <p className="mt-8 font-semibold text-blue-300">{submissions.length ? "Browse your solutions" : "Set up your library"}</p>
            </div>
          </Link>
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7 shadow-xl shadow-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-xl text-blue-300">↻</span>
            <h2 className="mt-8 text-xl font-semibold text-white">Always current</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Single submissions and history imports appear from the same trusted database whenever this page is loaded.</p>
            <Link href="/library" className="mt-7 inline-flex text-sm font-semibold text-blue-400 hover:text-blue-300">Open library →</Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
