export default function LibraryLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-[#070a12] px-5 py-12 sm:px-8">
      <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
      <div className="mt-12 h-10 w-72 animate-pulse rounded bg-slate-800" />
      <div className="mt-8 h-20 animate-pulse rounded-2xl bg-slate-800" />
      <div className="mt-5 space-y-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-800" />)}
      </div>
    </main>
  );
}
