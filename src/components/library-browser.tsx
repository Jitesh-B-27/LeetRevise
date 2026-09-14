"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LibrarySubmissionSummary } from "@/lib/services/submission-library";

interface LibraryBrowserProps {
  submissions: LibrarySubmissionSummary[];
}

const difficultyStyles = {
  Easy: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20",
  Medium: "bg-amber-500/10 text-amber-300 ring-amber-400/20",
  Hard: "bg-rose-500/10 text-rose-300 ring-rose-400/20",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function LibraryBrowser({ submissions }: LibraryBrowserProps) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [language, setLanguage] = useState("All");
  const [sort, setSort] = useState("newest");
  const languages = useMemo(
    () => [...new Set(submissions.map((item) => item.language))].sort(),
    [submissions],
  );
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return submissions
      .filter(
        (item) =>
          (!normalizedQuery ||
            item.title.toLowerCase().includes(normalizedQuery) ||
            item.problemSlug.toLowerCase().includes(normalizedQuery)) &&
          (difficulty === "All" || item.difficulty === difficulty) &&
          (language === "All" || item.language === language),
      )
      .sort((left, right) => {
        if (sort === "oldest") return left.submittedAt.localeCompare(right.submittedAt);
        if (sort === "title") return left.title.localeCompare(right.title);
        return right.submittedAt.localeCompare(left.submittedAt);
      });
  }, [difficulty, language, query, sort, submissions]);

  return (
    <>
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4 shadow-xl shadow-black/20 md:grid-cols-[minmax(220px,1fr)_repeat(3,auto)]">
        <label className="relative">
          <span className="sr-only">Search problems</span>
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
          <input
            aria-label="Search problems"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or slug"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label>
          <span className="sr-only">Difficulty</span>
          <select aria-label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option>All</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Language</span>
          <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option>All</option>
            {languages.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort problems</span>
          <select aria-label="Sort problems" value={sort} onChange={(event) => setSort(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
        <p>{visible.length} {visible.length === 1 ? "problem" : "problems"}</p>
        <p>Fresh from your latest import</p>
      </div>

      {visible.length ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/65 shadow-xl shadow-black/20">
          {visible.map((submission) => (
            <Link
              key={submission.id}
              href={`/library/${submission.id}`}
              className="group grid gap-3 border-b border-slate-800 px-5 py-5 transition last:border-b-0 hover:bg-slate-800/70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold text-slate-100 group-hover:text-blue-300">{submission.title}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${difficultyStyles[submission.difficulty]}`}>
                    {submission.difficulty}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span>{submission.language}</span>
                  {submission.runtimeMs != null ? <span>{submission.runtimeMs} ms</span> : null}
                  {submission.memoryMb != null ? <span>{submission.memoryMb} MB</span> : null}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <time className="text-sm text-slate-500" dateTime={submission.submittedAt}>{formatDate(submission.submittedAt)}</time>
                <span aria-hidden="true" className="text-xl text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400">→</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-slate-200">No problems match this view</p>
          <p className="mt-2 text-sm text-slate-500">Try clearing a search term or choosing a different filter.</p>
        </div>
      )}
    </>
  );
}
