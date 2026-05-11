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
  initialValues
}: {
  workflow: string;
  fields: FieldConfig[];
  initialValues: Record<string, string | boolean>;
}) {
  const [form, setForm] = useState(initialValues);
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate() {
    setIsGenerating(true);
    setError(null);

    const response = await fetch(`/api/workflows/${workflow}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await response.json();

    setIsGenerating(false);

    if (!response.ok) {
      setError(payload.error ?? "Generation failed.");
      return;
    }

    setOutput(payload.data);
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
          <Button onClick={generate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {output ? (
          <JsonOutput value={output} />
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-500">
            Generated output will appear here.
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
