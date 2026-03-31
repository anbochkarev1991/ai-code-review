import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HeaderClient } from "./header-client";
import { parseMeResponse } from "shared";

export async function Header() {
  const supabase = await createClient();
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data?.session;

  const isAuthenticated = !!session?.user;
  const user = session?.user;

  // Fetch user profile if authenticated
  let userEmail = "";
  let userName: string | undefined;
  let avatarUrl: string | undefined;

  if (isAuthenticated && user && session?.access_token) {
    userEmail = user.email || "";
    
    // Try to fetch profile from backend, but fallback to Supabase metadata
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
      const res = await fetch(`${backendUrl}/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const json: unknown = await res.json();
        const meData = parseMeResponse(json);
        userName = meData?.profile?.display_name || undefined;
        avatarUrl = meData?.profile?.avatar_url || undefined;
      }
    } catch {
      // Silently fallback to Supabase metadata
      console.debug("Failed to fetch profile from backend, using Supabase metadata");
    }

    // Fallback to Supabase user metadata if backend fetch failed
    if (!userName) {
      userName = user.user_metadata?.display_name || user.user_metadata?.name;
    }
    if (!avatarUrl) {
      avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    }
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/dashboard", label: "Dashboard", requiresAuth: true },
    { href: "/reviews", label: "Reviews", requiresAuth: true },
  ];

  type NavLinkItem = { href: string; label: string; requiresAuth?: boolean };
  const filteredNavLinks = navLinks.filter(
    (link: NavLinkItem) => !link.requiresAuth || isAuthenticated
  );

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/80">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            <span>AI Code Review</span>
          </Link>

          {/* Navigation and User Menu */}
          <HeaderClient
            links={filteredNavLinks}
            isAuthenticated={isAuthenticated}
            userEmail={userEmail}
            userName={userName}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </header>
  );
}

