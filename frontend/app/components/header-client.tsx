"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserMenu } from "./user-menu";

interface HeaderClientProps {
  links: Array<{ href: string; label: string }>;
  isAuthenticated: boolean;
  userEmail: string;
  userName?: string;
  avatarUrl?: string;
}

export function HeaderClient({
  links,
  isAuthenticated,
  userEmail,
  userName,
  avatarUrl,
}: HeaderClientProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="flex flex-1 items-center justify-end gap-4">
        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: User menu or Login */}
        {isAuthenticated ? (
          <UserMenu
            userEmail={userEmail}
            userName={userName}
            avatarUrl={avatarUrl}
          />
        ) : (
          <Link
            href="/login"
            className="hidden rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 md:inline-block"
          >
            Sign In
          </Link>
        )}

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden"
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <svg
              className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation - rendered outside flex container but inside header */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-16 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <MobileNavigation
              links={links}
              currentPath={pathname}
              isAuthenticated={isAuthenticated}
              onLinkClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function MobileNavigation({
  links,
  currentPath,
  isAuthenticated,
  onLinkClick,
}: {
  links: Array<{ href: string; label: string }>;
  currentPath?: string | null;
  isAuthenticated: boolean;
  onLinkClick: () => void;
}) {
  return (
    <nav>
      <div className="flex flex-col gap-2">
        {links.map((link) => {
          const isActive =
            currentPath === link.href ||
            (link.href !== "/" && currentPath?.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onLinkClick}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        {!isAuthenticated && (
          <Link
            href="/login"
            onClick={onLinkClick}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

