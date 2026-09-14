import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSubmissionLibraryService } from "@/lib/services/submission-library";
import { LibraryBrowser } from "@/components/library-browser";

export const dynamic = "force-dynamic";

function EmptyLibrary() {
  const steps = [
    { number: "01", title: "Load the extension", text: "Open Chrome extensions, enable Developer mode, and load the project’s extension folder." },
    { number: "02", title: "Link your account", text: "Paste your LeetRevise ingestion token, verify the connection, then link the active LeetCode account." },
    { number: "03", title: "Bring in your solves", text: "Scan accepted history for the first import. New accepted solutions can then arrive one at a time." },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/50 px-6 py-10 shadow-2xl shadow-black/25 sm:px-10">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl" />
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-400">Your library is ready for its first solve</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white">Turn your LeetCode history into a place worth returning to.</h2>
      <div className="relative mt-10 grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <article key={step.number} className="relative rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5 shadow-sm backdrop-blur">
            <span className="text-xs font-bold tracking-[0.2em] text-blue-400">STEP {step.number}</span>
            <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
            {index < steps.length - 1 ? <span aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-sm text-white lg:flex">→</span> : null}
          </article>
        ))}
      </div>
      <details id="extension-setup" className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
        <summary className="cursor-pointer font-semibold text-white">Show extension setup</summary>
        <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
          <span><strong className="block text-slate-200">Chrome</strong>Visit chrome://extensions</span>
          <span><strong className="block text-slate-200">Developer mode</strong>Turn it on in the toolbar</span>
          <span><strong className="block text-slate-200">Load unpacked</strong>Select the extension folder</span>
        </div>
      </details>
    </section>
  );
}

export default async function LibraryPage() {
  const userId = await requireAuthenticatedUser();
  const submissions = await createSubmissionLibraryService().list(userId);

  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-bold uppercase tracking-[0.18em] text-blue-400">LeetRevise</Link>
          <Link href="/dashboard" className="text-sm font-semibold text-slate-400 hover:text-white">Dashboard</Link>
        </nav>
        <header className="mb-8 mt-12">
          <p className="text-sm font-semibold text-blue-400">Problem library</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-white">Your solved problems</h1>
            {submissions.length ? <p className="text-sm text-slate-500">{submissions.length} saved across your LeetCode journey</p> : null}
          </div>
        </header>
        {submissions.length ? <LibraryBrowser submissions={submissions} /> : <EmptyLibrary />}
      </div>
    </main>
  );
}
