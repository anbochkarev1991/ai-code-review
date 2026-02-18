import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Checkout canceled
        </h1>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          You canceled the checkout. No charges were made. You can upgrade to Pro
          anytime from the dashboard.
        </p>
        <div className="flex w-full flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/"
            className="text-center text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Return home
          </Link>
        </div>
      </main>
    </div>
  );
}
