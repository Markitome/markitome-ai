"use client";

import { Button, Field, TextInput } from "@markitome/ui";
import { useEffect, useState } from "react";

type Summary = {
  users: number;
  usageLogs: number;
  generatedFiles: number;
  auditLogs: number;
  dailyUsageLimitPlaceholder: string;
  monthlyUsageLimitPlaceholder: string;
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  roles: string[];
};

export function AdminPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function loadAdminData() {
    const [summaryResponse, usersResponse] = await Promise.all([
      fetch("/api/admin/summary"),
      fetch("/api/admin/users")
    ]);

    if (summaryResponse.ok) {
      setSummary((await summaryResponse.json()).data);
    }

    if (usersResponse.ok) {
      setUsers((await usersResponse.json()).data);
    }
  }

  async function addAllowlistEmail() {
    setMessage(null);
    const response = await fetch("/api/admin/allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, note })
    });
    const payload = await response.json();
    setMessage(response.ok ? `Allowlisted ${payload.data.email}` : payload.error ?? "Unable to add email.");
    if (response.ok) {
      setEmail("");
      setNote("");
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Users", summary?.users ?? 0],
          ["Usage logs", summary?.usageLogs ?? 0],
          ["Generated files", summary?.generatedFiles ?? 0],
          ["Audit logs", summary?.auditLogs ?? 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Usage Limits</h2>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-neutral-600">
          <p>{summary?.dailyUsageLimitPlaceholder ?? "Daily usage limits will appear here."}</p>
          <p>{summary?.monthlyUsageLimitPlaceholder ?? "Monthly usage limits will appear here."}</p>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">External Allowlist</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Email">
            <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Note">
            <TextInput value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button onClick={addAllowlistEmail}>Add</Button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm font-medium text-leaf">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Users</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2">{user.name ?? "Unknown"}</td>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.status}</td>
                  <td className="px-3 py-2">{user.roles.join(", ")}</td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-neutral-500" colSpan={4}>
                    No users found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
