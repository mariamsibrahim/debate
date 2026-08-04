"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function NavHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          Debate
        </Link>
        <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-wide text-ink-muted">
          <Link href="/leaderboard" className="hover:text-brass">
            Leaderboard
          </Link>
          {user ? (
            <>
              <Link href={`/profile/${user.username}`} className="hover:text-brass">
                {user.username}
              </Link>
              <button onClick={logout} className="hover:text-danger">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-brass">
                Sign in
              </Link>
              <Link href="/sign-up" className="rounded-full border border-brass px-3 py-1.5 text-brass hover:bg-brass-soft">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
