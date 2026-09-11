import { signOut } from "@/app/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  await requireAuthenticatedUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          LeetRevise
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          You&apos;re signed in.
        </h1>
        <p className="mt-3 text-slate-600">
          Your revision workspace will be built here next.
        </p>
        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
