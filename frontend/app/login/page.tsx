import { LoginButtons } from "./LoginButtons";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                AI Code Review Assistant
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in to get started
              </p>
            </div>
            <LoginButtons />
          </div>
        </div>
      </div>
    </div>
  );
}
