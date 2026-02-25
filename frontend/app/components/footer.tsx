import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              AI Code Review Assistant
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Get comprehensive, AI-powered code reviews for your GitHub pull requests.
            </p>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Product
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/reviews"
                  className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Reviews
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Legal
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Support
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            © {currentYear} AI Code Review Assistant. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
