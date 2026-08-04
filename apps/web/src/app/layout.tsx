import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { NavHeader } from "@/components/NavHeader";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Debate — Make intelligent disagreement the default",
  description: "AI-moderated, ranked structured debate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink font-sans">
        <AuthProvider>
          <NavHeader />
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
