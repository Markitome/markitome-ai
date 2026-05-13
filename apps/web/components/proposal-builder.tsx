"use client";

import { Button, Field, TextArea, TextInput } from "@markitome/ui";
import {
  buildProposalPricing,
  generateProposalFileName,
  proposalAcceptanceText,
  proposalContactInfo,
  proposalGstNote,
  proposalOnActualsNote,
  proposalTermsAndConditions
} from "@markitome/shared";
import type { ProposalOutput, ProposalPricingRow, ProposalPricingSummary } from "@markitome/shared";
import { useState } from "react";

const initialForm = {
  clientName: "",
  clientWebsite: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  industry: "",
  requiredServices: "",
  budgetRange: "",
  timeline: "",
  proposalObjective: "",
  notes: "",
  discountPercent: "0",
  proposalNumber: "MAPRO",
  iteration: "001",
  useKnowledgeBase: false
};

export function ProposalBuilder() {
  const [form, setForm] = useState(initialForm);
  const [output, setOutput] = useState<ProposalOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingToDrive, setIsAddingToDrive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveMessage, setDriveMessage] = useState<string | null>(null);
  const [needsGoogleReconnect, setNeedsGoogleReconnect] = useState(false);

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

  async function addToGoogleDrive() {
    if (!output) return;

    setIsAddingToDrive(true);
    setDriveMessage(null);
    setNeedsGoogleReconnect(false);

    const response = await fetch("/api/proposals/add-to-drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output })
    });

    setIsAddingToDrive(false);
    const payload = await response.json();

    if (!response.ok) {
      setDriveMessage(payload.error ?? "Unable to add proposal to Google Drive.");
      setNeedsGoogleReconnect(payload.code === "GOOGLE_RECONNECT_REQUIRED");
      return;
    }

    const url = payload.data?.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setDriveMessage("Proposal added to Google Drive.");
  }

  function reconnectGoogleDrive() {
    window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent("/proposal-builder")}`;
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client email">
              <TextInput value={form.clientEmail} onChange={(event) => updateField("clientEmail", event.target.value)} />
            </Field>
            <Field label="Client phone">
              <TextInput value={form.clientPhone} onChange={(event) => updateField("clientPhone", event.target.value)} />
            </Field>
          </div>
          <Field label="Client address">
            <TextArea value={form.clientAddress} onChange={(event) => updateField("clientAddress", event.target.value)} />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount (%)">
              <TextInput value={form.discountPercent} onChange={(event) => updateField("discountPercent", event.target.value)} />
            </Field>
            <Field label="Proposal number">
              <TextInput value={form.proposalNumber} onChange={(event) => updateField("proposalNumber", event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Iteration">
              <TextInput value={form.iteration} onChange={(event) => updateField("iteration", event.target.value)} />
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
          {driveMessage ? <p className="text-sm font-medium text-leaf">{driveMessage}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={generateProposal} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Proposal"}
            </Button>
            {needsGoogleReconnect ? (
              <button
                className="rounded-md border border-leaf bg-white px-4 py-2 text-sm font-medium text-leaf hover:bg-neutral-100"
                type="button"
                onClick={reconnectGoogleDrive}
              >
                Reconnect Google Drive
              </button>
            ) : null}
            <button
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              type="button"
              onClick={addToGoogleDrive}
              disabled={!output || isAddingToDrive}
            >
              {isAddingToDrive ? "Adding..." : "Add to Google Drive"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {output ? (
          <div className="grid gap-5">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              <p><span className="font-semibold text-ink">Proposal number:</span> {output.proposalNumber}</p>
              <p className="mt-1"><span className="font-semibold text-ink">File name:</span> {output.fileName}</p>
              <p className="mt-1"><span className="font-semibold text-ink">Client:</span> {output.clientName} {output.clientUrl ? `(${output.clientUrl})` : ""}</p>
            </div>
            <h2 className="text-2xl font-semibold text-ink">{output.proposalTitle}</h2>
            <OutputBlock title="Executive summary" content={output.executiveSummary} />
            <OutputBlock title="Client understanding" content={output.clientUnderstanding} />
            <OutputList title="Scope of services" items={output.scopeOfServices} />
            <OutputList title="Deliverables" items={output.deliverables} />
            <OutputBlock title="Timeline" content={output.timeline} />
            <OutputBlock title="Commercial structure" content={output.commercialStructure} />
            <PricingTable rows={output.pricingTable} summary={output.pricingSummary} />
            <OutputList title="Tax and on-actuals notes" items={output.taxAndActualsNotes} />
            <OutputList title="Terms and conditions" items={output.termsAndConditions} />
            <OutputList title="Acceptance" items={output.acceptance} />
            <OutputList
              title="Contact information"
              items={[
                output.contactInformation.company,
                output.contactInformation.address,
                output.contactInformation.email,
                output.contactInformation.phone
              ]}
            />
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

function PricingTable({ rows, summary }: { rows: ProposalPricingRow[]; summary: ProposalPricingSummary }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-leaf">Budget and fees</h3>
      <div className="mt-3 overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">India price</th>
              <th className="px-3 py-2 font-medium">Selected</th>
              <th className="px-3 py-2 font-medium">Payment terms</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.service} className="border-t border-neutral-200 align-top">
                <td className="px-3 py-2 font-medium text-ink">{row.service}</td>
                <td className="px-3 py-2 text-neutral-700">{row.indiaLow}</td>
                <td className="px-3 py-2 text-neutral-700">{row.selectedAmount}</td>
                <td className="px-3 py-2 text-neutral-700">{row.paymentTerms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-2 rounded-md bg-neutral-50 p-4 text-sm text-neutral-700 sm:grid-cols-2">
        <p><span className="font-semibold text-ink">Subtotal:</span> {summary.subtotal}</p>
        <p><span className="font-semibold text-ink">Discount:</span> {summary.discountPercent}% ({summary.discountAmount})</p>
        <p className="sm:col-span-2"><span className="font-semibold text-ink">Consolidated total after discount:</span> {summary.totalAfterDiscount}</p>
      </div>
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
  const pricing = buildProposalPricing(form.requiredServices, form.discountPercent);
  const fileName = generateProposalFileName(form);

  return {
    proposalNumber: toText(record.proposalNumber ?? record.proposal_number, fileName),
    fileName: toText(record.fileName ?? record.file_name, fileName),
    clientName: toText(record.clientName ?? record.client_name, form.clientName),
    clientUrl: toText(record.clientUrl ?? record.client_url, form.clientWebsite),
    clientEmail: toText(record.clientEmail ?? record.client_email, form.clientEmail),
    clientPhone: toText(record.clientPhone ?? record.client_phone, form.clientPhone),
    clientAddress: toText(record.clientAddress ?? record.client_address, form.clientAddress),
    proposalTitle: toText(record.proposalTitle ?? record.proposal_title, `${form.clientName || "Client"} Growth Proposal`),
    executiveSummary: toText(record.executiveSummary ?? record.executive_summary, "Executive summary was not provided."),
    clientUnderstanding: toText(
      record.clientUnderstanding ?? record.client_understanding,
      `${form.clientName || "The client"} needs a focused plan for ${form.proposalObjective || "the stated objective"}.`
    ),
    scopeOfServices: toList(record.scopeOfServices ?? record.scope_of_services, form.requiredServices),
    deliverables: toList(record.deliverables, "Strategy roadmap, execution plan, reporting"),
    timeline: toText(record.timeline, form.timeline || "Timeline to be confirmed."),
    commercialStructure: toText(
      record.commercialStructure ?? record.commercial_structure,
      `Subtotal ${pricing.pricingSummary.subtotal}; discount ${pricing.pricingSummary.discountPercent}%; total after discount ${pricing.pricingSummary.totalAfterDiscount}.`
    ),
    pricingTable: normalizePricingTable(record.pricingTable ?? record.pricing_table, pricing.pricingTable),
    pricingSummary: normalizePricingSummary(record.pricingSummary ?? record.pricing_summary, pricing.pricingSummary),
    taxAndActualsNotes: [proposalGstNote, proposalOnActualsNote],
    termsAndConditions: proposalTermsAndConditions,
    acceptance: proposalAcceptanceText,
    contactInformation: proposalContactInfo,
    nextSteps: toList(record.nextSteps ?? record.next_steps, "Confirm scope, approve commercials, schedule kickoff")
  };
}

function normalizePricingTable(value: unknown, fallback: ProposalPricingRow[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const fallbackRow = fallback[index] ?? fallback[0];
    return {
      service: toText(row.service, fallbackRow.service),
      features: toText(row.features, fallbackRow.features ?? ""),
      indiaLow: toText(row.indiaLow ?? row.india_low, fallbackRow.indiaLow),
      indiaHigh: toText(row.indiaHigh ?? row.india_high, fallbackRow.indiaHigh ?? ""),
      paymentTerms: toText(row.paymentTerms ?? row.payment_terms, fallbackRow.paymentTerms),
      selectedAmount: toText(row.selectedAmount ?? row.selected_amount, fallbackRow.selectedAmount),
      notes: toText(row.notes, fallbackRow.notes)
    };
  });
}

function normalizePricingSummary(value: unknown, fallback: ProposalPricingSummary) {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    subtotal: toText(row.subtotal, fallback.subtotal),
    discountPercent: Number(row.discountPercent ?? row.discount_percent ?? fallback.discountPercent),
    discountAmount: toText(row.discountAmount ?? row.discount_amount, fallback.discountAmount),
    totalAfterDiscount: toText(row.totalAfterDiscount ?? row.total_after_discount, fallback.totalAfterDiscount),
    gstNote: proposalGstNote,
    onActualsNote: proposalOnActualsNote
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
