import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Terms of Service
          </h1>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Agreement to Terms
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                By accessing or using AI Code Review Assistant ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Use License
              </h2>
              <p className="mb-2 text-zinc-600 dark:text-zinc-400">
                Permission is granted to use the Service for personal or commercial purposes, subject to the following restrictions:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-4">
                <li>You must not use the Service in any way that violates applicable laws</li>
                <li>You must not attempt to reverse engineer or compromise the Service</li>
                <li>You must respect rate limits and usage quotas</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Subscription and Billing
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                The Service offers both free and paid subscription plans. Paid subscriptions are billed monthly and automatically renew unless cancelled. You may cancel your subscription at any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Disclaimer
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                The Service is provided "as is" without warranties of any kind. We do not guarantee that the AI-generated code reviews will be error-free or suitable for your specific needs.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Contact Us
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                If you have questions about these Terms, please contact us at{" "}
                <Link
                  href="/contact"
                  className="text-zinc-900 underline dark:text-zinc-100"
                >
                  our contact page
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
