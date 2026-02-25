import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-4xl flex-col items-center gap-8 text-center">
          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl dark:text-zinc-100">
              AI Code Review Assistant
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-zinc-600 sm:text-xl dark:text-zinc-400">
              Get comprehensive, AI-powered code reviews for your GitHub pull requests.
              Analyze code quality, architecture, performance, and security in seconds.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/login"
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign In
            </Link>
          </div>

          {/* Features Grid */}
          <div className="mt-16 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <svg
                  className="h-6 w-6 text-zinc-900 dark:text-zinc-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Code Quality
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Detect bugs, code smells, and best practice violations automatically.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <svg
                  className="h-6 w-6 text-zinc-900 dark:text-zinc-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Architecture
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Evaluate design patterns, structure, and maintainability of your codebase.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <svg
                  className="h-6 w-6 text-zinc-900 dark:text-zinc-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Performance
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Identify bottlenecks, optimization opportunities, and performance issues.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <svg
                  className="h-6 w-6 text-zinc-900 dark:text-zinc-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Security
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Catch vulnerabilities, security anti-patterns, and potential exploits.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-16 flex w-full flex-col gap-6">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              How It Works
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  1
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Connect GitHub
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Link your GitHub account to access your repositories and pull requests.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  2
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Select PR
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Choose a repository and pull request you want to review.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  3
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Get Review
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Receive comprehensive AI-powered feedback in seconds with detailed findings and suggestions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
