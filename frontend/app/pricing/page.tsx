import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { plans } from "@/lib/plans";

export default async function PricingPage() {
  const supabase = await createClient();
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data?.session;
  const isAuthenticated = !!session?.user;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
            Pricing
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Choose the plan that fits your needs
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border bg-white p-8 shadow-sm dark:bg-zinc-900 ${
                plan.recommended
                  ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {plan.name}
                </h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                    {plan.price}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    /month
                  </span>
                </div>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-zinc-900 dark:text-zinc-100"
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
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={isAuthenticated ? "/dashboard" : "/login"}
                className={`block w-full rounded-lg px-6 py-3 text-center text-sm font-medium transition-colors ${
                  plan.recommended
                    ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {plan.id === "free"
                  ? "Get Started"
                  : isAuthenticated
                    ? "Upgrade to Pro"
                    : "Upgrade to Pro"}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
