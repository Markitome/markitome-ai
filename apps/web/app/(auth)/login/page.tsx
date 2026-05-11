"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-mist px-6">
      <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-leaf">Markitome AI</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Team workspace login</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Access is restricted to approved Markitome users and allowlisted collaborators.
          </p>
        </div>
        <button
          className="flex h-11 w-full items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          Continue with Google
        </button>
      </section>
    </main>
  );
}
