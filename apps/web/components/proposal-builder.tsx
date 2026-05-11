"use client";

import { Button, Field, TextArea, TextInput } from "@markitome/ui";
import type { ProposalOutput } from "@markitome/shared";
import { useState } from "react";

const initialForm = {
  clientName: "",
  clientWebsite: "",
  industry: "",
  requiredServices: "",
  budgetRange: "",
  timeline: "",
  proposalObjective: "",
  notes: "",
  useKnowledgeBase: false
};

export function ProposalBuilder() {
  const [form, setForm] = useState(initialForm);
  const [output, setOutput] = useState<ProposalOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function generateProposal() {
    setIsGenerating(true);
    setError(null);

    const response = await fetch("/api/proposals/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const payload = await response.json();
    setIsGenerating(false);

    if (!response.ok) {
      setError(payload.error ?? "Proposal generation failed.");
      return;
    }

    setOutput(normalizeProposalOutput(payload.data, form));
  }

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveToDrive() {
    setSaveMessage(null);
    const response = await fetch("/api/google/drive/save-generated-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: output?.proposalTitle ?? `${form.clientName || "Client"} Proposal`,
        type: "proposal",
        output
      })
    });
    const payload = await response.json();
    setSaveMessage(response.ok ? payload.data.TODO ?? "Google Drive placeholder completed." : payload.error ?? "Save failed.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_1fr]">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4">
          <Field label="Client name">
            <TextInput value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} />
          </Field>
          <Field label="Client website">
            <TextInput value={form.clientWebsite} onChange={(event) => updateField("clientWebsite", event.target.value)} />
          </Field>
          <Field label="Industry">
            <TextInput value={form.industry} onChange={(event) => updateField("industry", event.target.value)} />
          </Field>
          <Field label="Required services">
            <TextArea value={form.requiredServices} onChange={(event) => updateField("requiredServices", event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget range">
              <TextInput value={form.budgetRange} onChange={(event) => updateField("budgetRange", event.target.value)} />
            </Field>
            <Field label="Timeline">
              <TextInput value={form.timeline} onChange={(event) => updateField("timeline", event.target.value)} />
            </Field>
          </div>
          <Field label="Proposal objective">
            <TextArea value={form.proposalObjective} onChange={(event) => updateField("proposalObjective", event.target.value)} />
          </Field>
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={form.useKnowledgeBase}
              onChange={(event) => updateField("useKnowledgeBase", event.target.checked)}
            />
            Use Knowledge Base
          </label>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          {saveMessage ? <p className="text-sm font-medium text-leaf">{saveMessage}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={generateProposal} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Proposal"}
            </Button>
            <button
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              type="button"
              onClick={saveToDrive}
              disabled={!output}
            >
              Save to Google Drive
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {output ? (
          <div className="grid gap-5">
            <h2 className="text-2xl font-semibold text-ink">{output.proposalTitle}</h2>
            <OutputBlock title="Executive summary" content={output.executiveSummary} />
            <OutputBlock title="Client understanding" content={output.clientUnderstanding} />
            <OutputList title="Scope of services" items={output.scopeOfServices} />
            <OutputList title="Deliverables" items={output.deliverables} />
            <OutputBlock title="Timeline" content={output.timeline} />
            <OutputBlock title="Commercial structure" content={output.commercialStructure} />
            <OutputList title="Terms and conditions" items={output.termsAndConditions} />
            <OutputList title="Next steps" items={output.nextSteps} />
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-500">
            Generated proposal sections will appear here.
          </div>
        )}
      </section>
    </div>
  );
}

function OutputBlock({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-leaf">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-700">{content}</p>
    </div>
  );
}

function OutputList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-leaf">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function normalizeProposalOutput(value: unknown, form: typeof initialForm): ProposalOutput {
  const record = unwrapRecord(value);

  return {
    proposalTitle: toText(record.proposalTitle ?? record.proposal_title, `${form.clientName || "Client"} Growth Proposal`),
    executiveSummary: toText(record.executiveSummary ?? record.executive_summary, "Executive summary was not provided."),
    clientUnderstanding: toText(
      record.clientUnderstanding ?? record.client_understanding,
      `${form.clientName || "The client"} needs a focused plan for ${form.proposalObjective || "the stated objective"}.`
    ),
    scopeOfServices: toList(record.scopeOfServices ?? record.scope_of_services, form.requiredServices),
    deliverables: toList(record.deliverables, "Strategy roadmap, execution plan, reporting"),
    timeline: toText(record.timeline, form.timeline || "Timeline to be confirmed."),
    commercialStructure: toText(record.commercialStructure ?? record.commercial_structure, form.budgetRange || "Commercials to be confirmed."),
    termsAndConditions: toList(record.termsAndConditions ?? record.terms_and_conditions, "Final scope subject to discovery."),
    nextSteps: toList(record.nextSteps ?? record.next_steps, "Confirm scope, approve commercials, schedule kickoff")
  };
}

function unwrapRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};

  const record = value as Record<string, unknown>;
  for (const key of ["proposal", "proposalRecord", "proposal_record", "output", "data", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  }

  return record;
}

function toText(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return fallback;
}

function toList(value: unknown, fallback: string) {
  if (Array.isArray(value)) return value.map((item) => toText(item, "")).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|,/)
      .map((item) => item.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean);
  }
  return fallback.split(",").map((item) => item.trim()).filter(Boolean);
}
