import Link from "next/link";
import { requestMagicLink } from "@/app/auth/actions";

interface AuthPageProps {
  mode: "login" | "signup";
  status?: string;
}

export function AuthPage({ mode, status }: AuthPageProps) {
  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600"
        >
          LeetRevise
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isSignup
            ? "Start building a revision library from your accepted solutions."
            : "Sign in to continue to your revision workspace."}
        </p>

        {status === "sent" ? (
          <p
            role="status"
            className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Check your email and open the secure sign-in link.
          </p>
        ) : null}
        {status === "invalid" || status === "failed" ? (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {status === "invalid"
              ? "Enter a valid email address."
              : "We could not send the email. Please try again."}
          </p>
        ) : null}

        <form action={requestMagicLink} className="mt-6 space-y-4">
          <input type="hidden" name="mode" value={mode} />
          <label className="block text-sm font-medium text-slate-700">
            Email address
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            {isSignup ? "Sign up with email" : "Log in with email"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isSignup ? "Already have an account?" : "New to LeetRevise?"}{" "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
