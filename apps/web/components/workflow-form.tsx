"use client";

import { Button, Field, TextArea, TextInput } from "@markitome/ui";
import { useState } from "react";

type FieldConfig = {
  name: string;
  label: string;
  multiline?: boolean;
  checkbox?: boolean;
  placeholder?: string;
};

export function WorkflowForm({
  workflow,
  fields,
  initialValues,
  saveLabel = "Save to Google Drive"
}: {
  workflow: string;
  fields: FieldConfig[];
  initialValues: Record<string, string | boolean>;
  saveLabel?: string;
}) {
  const [form, setForm] = useState(initialValues);
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    setSaveMessage(null);
    setCopyMessage(null);

    try {
      const response = await fetch(`/api/workflows/${workflow}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Generation failed.");
        return;
      }

      setOutput(payload.data);
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(formatOutput(output));
    setCopyMessage("Copied output.");
  }

  async function saveToDrive() {
    if (!output) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/google/drive/save-generated-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: inferTitle(workflow, form, output),
          type: workflow,
          input: form,
          output
        })
      });
      const payload = await response.json();
      setSaveMessage(response.ok ? payload.data.TODO ?? "Google Drive placeholder completed." : payload.error ?? "Save failed.");
    } catch {
      setSaveMessage("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function setField(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_1fr]">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4">
          {fields.map((field) => (
            field.checkbox ? (
              <label key={field.name} className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={Boolean(form[field.name])}
                  onChange={(event) => setField(field.name, event.target.checked)}
                />
                {field.label}
              </label>
            ) : (
              <Field key={field.name} label={field.label}>
                {field.multiline ? (
                <TextArea
                  placeholder={field.placeholder}
                  value={String(form[field.name] ?? "")}
                  onChange={(event) => setField(field.name, event.target.value)}
                />
              ) : (
                <TextInput
                  placeholder={field.placeholder}
                  value={String(form[field.name] ?? "")}
                  onChange={(event) => setField(field.name, event.target.value)}
                />
              )}
              </Field>
            )
          ))}
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          {copyMessage ? <p className="text-sm font-medium text-leaf">{copyMessage}</p> : null}
          {saveMessage ? <p className="text-sm font-medium text-leaf">{saveMessage}</p> : null}
          <Button onClick={generate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {output ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="font-semibold text-ink">Generated Output</h2>
                <p className="mt-1 text-sm text-neutral-500">Review, copy, or save this draft through the protected backend.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  type="button"
                  onClick={copyOutput}
                >
                  Copy
                </button>
                <button
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={saveToDrive}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : saveLabel}
                </button>
              </div>
            </div>
            <JsonOutput value={output} />
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-500">
            Complete the form and generate a draft. Output, copy, and save actions will appear here.
          </div>
        )}
      </section>
    </div>
  );
}

export function JsonOutput({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="grid gap-2">
        {value.map((item, index) => (
          <li key={index} className="rounded-md bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">
            <JsonOutput value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === "object") {
    return (
      <div className="grid gap-5">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-leaf">{humanize(key)}</h3>
            <div className="mt-2 text-sm leading-6 text-neutral-700">
              <JsonOutput value={item} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">{String(value ?? "")}</p>;
}

function humanize(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

function formatOutput(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function inferTitle(workflow: string, form: Record<string, string | boolean>, output: unknown) {
  const record = output && typeof output === "object" ? (output as Record<string, unknown>) : {};
  const explicitTitle =
    record.seoTitle ??
    record.metaTitle ??
    record.emailSubject ??
    record.presentationTitle ??
    record.indexedDocument ??
    record.promptUsed;

  if (typeof explicitTitle === "string" && explicitTitle.trim()) return explicitTitle;
  if (typeof form.clientName === "string" && form.clientName.trim()) return `${form.clientName} ${humanize(workflow)} Draft`;
  if (typeof form.topic === "string" && form.topic.trim()) return form.topic;
  if (typeof form.title === "string" && form.title.trim()) return form.title;
  return `${humanize(workflow)} Draft`;
}
