import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Contact Us
          </h1>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              We'd love to hear from you! Whether you have a question, feedback, or need support, we're here to help.
            </p>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Get in Touch
              </h2>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                For general inquiries, support requests, or feedback about AI Code Review Assistant, please reach out through one of the following channels:
              </p>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <strong className="text-zinc-900 dark:text-zinc-100">Email:</strong> support@aicodereview.com
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <strong className="text-zinc-900 dark:text-zinc-100">Response Time:</strong> We typically respond within 24-48 hours.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Support
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                If you're experiencing technical issues or have questions about using the service, please include:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-4 mt-2">
                <li>A description of the issue or question</li>
                <li>Steps to reproduce (if applicable)</li>
                <li>Your account email (if logged in)</li>
                <li>Any error messages you've encountered</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Legal & Privacy
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                For privacy-related inquiries, please review our{" "}
                <Link
                  href="/privacy"
                  className="text-zinc-900 underline dark:text-zinc-100"
                >
                  Privacy Policy
                </Link>
                . For terms and conditions, see our{" "}
                <Link
                  href="/terms"
                  className="text-zinc-900 underline dark:text-zinc-100"
                >
                  Terms of Service
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
