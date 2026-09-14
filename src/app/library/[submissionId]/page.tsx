import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSubmissionLibraryService } from "@/lib/services/submission-library";

export const dynamic = "force-dynamic";

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

export default async function LibrarySubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const userId = await requireAuthenticatedUser();
  const { submissionId } = await params;
  const submission = await createSubmissionLibraryService().getById(userId, submissionId);
  if (!submission) notFound();

  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/library" className="text-sm font-semibold text-slate-400 hover:text-white">← Back to library</Link>
          <Link href="/dashboard" className="text-sm font-bold uppercase tracking-[0.18em] text-blue-400">LeetRevise</Link>
        </nav>
        <header className="mt-12 border-b border-slate-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300 ring-1 ring-slate-700">{submission.difficulty}</span>
            <span className="text-sm text-slate-500">{submission.language}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">{submission.title}</h1>
              <p className="mt-3 text-sm text-slate-500">Latest accepted submission · {formatSubmittedAt(submission.submittedAt)}</p>
            </div>
            <a href={submission.problemUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Open on LeetCode ↗</a>
          </div>
        </header>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Problem</p>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-300">{submission.problemDescription}</p>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Accepted solution</span>
              <div className="flex gap-3 text-xs text-slate-400">
                {submission.runtimeMs != null ? <span>{submission.runtimeMs} ms</span> : null}
                {submission.memoryMb != null ? <span>{submission.memoryMb} MB</span> : null}
              </div>
            </div>
            <pre className="max-h-[70vh] overflow-auto p-5 text-sm leading-6 text-slate-200"><code>{submission.code}</code></pre>
          </section>
        </div>
      </div>
    </main>
  );
}
