import { LoginButtons } from "./LoginButtons";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            AI Code Review Assistant
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to get started
          </p>
        </div>
        <LoginButtons />
      </main>
    </div>
  );
}
