import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Privacy Policy
          </h1>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Introduction
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                AI Code Review Assistant (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Information We Collect
              </h2>
              <p className="mb-2 text-zinc-600 dark:text-zinc-400">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-4">
                <li>Account information (email, display name, avatar)</li>
                <li>GitHub account connection data</li>
                <li>Code review requests and results</li>
                <li>Usage statistics and billing information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                How We Use Your Information
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-4">
                <li>Provide and maintain our service</li>
                <li>Process code reviews and generate AI-powered feedback</li>
                <li>Manage your account and subscriptions</li>
                <li>Improve our service and develop new features</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Data Security
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Contact Us
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                If you have questions about this Privacy Policy, please contact us at{" "}
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
