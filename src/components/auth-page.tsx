import Link from "next/link";
import { requestMagicLink } from "@/app/auth/actions";

interface AuthPageProps {
  mode: "login" | "signup";
  status?: string;
}

export function AuthPage({ mode, status }: AuthPageProps) {
  const isSignup = mode === "signup";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070a12] px-6 py-12 text-slate-100">
      <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-400"
        >
          LeetRevise
        </Link>
        <h1 className="mt-7 text-3xl font-bold tracking-tight text-white">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {isSignup
            ? "Start building a revision library from your accepted solutions."
            : "Sign in to continue to your revision workspace."}
        </p>

        {status === "sent" ? (
          <p
            role="status"
            className="mt-6 rounded-xl border border-emerald-800/60 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300"
          >
            Check your email and open the secure sign-in link.
          </p>
        ) : null}
        {status === "invalid" || status === "failed" ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-rose-900/60 bg-rose-950/50 px-4 py-3 text-sm text-rose-300"
          >
            {status === "invalid"
              ? "Enter a valid email address."
              : "We could not send the email. Please try again."}
          </p>
        ) : null}

        <form action={requestMagicLink} className="mt-6 space-y-4">
          <input type="hidden" name="mode" value={mode} />
          <label className="block text-sm font-medium text-slate-300">
            Email address
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400"
          >
            {isSignup ? "Sign up with email" : "Log in with email"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {isSignup ? "Already have an account?" : "New to LeetRevise?"}{" "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-semibold text-blue-400 hover:text-blue-300"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
