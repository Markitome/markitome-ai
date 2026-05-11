import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "../../lib/auth";
import { SignOutButton } from "../../components/sign-out-button";

const navItems = [
  ["Dashboard", "/dashboard"],
  ["Chat", "/chat"],
  ["Proposal Builder", "/proposal-builder"],
  ["Blog Writer", "/blog-writer"],
  ["Presentation Builder", "/presentation-builder"],
  ["Image Studio", "/image-studio"],
  ["Email Assistant", "/email-assistant"],
  ["Knowledge Base", "/knowledge-base"],
  ["Admin Panel", "/admin"]
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-mist">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 bg-white px-4 py-5 lg:block">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold text-ink">Markitome AI</p>
          <p className="mt-1 text-xs text-neutral-500">{session.user.email}</p>
        </div>
        <nav className="grid gap-1">
          {navItems.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4">
          <SignOutButton />
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-6 backdrop-blur">
          <p className="font-semibold text-ink lg:hidden">Markitome AI</p>
          <p className="hidden text-sm text-neutral-600 lg:block">Internal AI workspace</p>
          <div className="text-xs font-medium uppercase tracking-wide text-leaf">
            {session.user.roles.join(", ")}
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
          {navItems.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
