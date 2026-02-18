import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Checkout cancelled
        </h1>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          You cancelled the upgrade. No charges were made.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to dashboard
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
