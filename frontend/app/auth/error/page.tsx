import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Authentication error
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Something went wrong during sign in. Please try again.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Try again
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Return home
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
