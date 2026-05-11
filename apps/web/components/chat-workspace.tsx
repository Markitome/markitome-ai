"use client";

import { Button, Field, TextArea, TextInput } from "@markitome/ui";
import { useEffect, useMemo, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

const storageKey = "markitome-ai-chat-conversations";

export function ChatWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [knowledgeSource, setKnowledgeSource] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0],
    [activeId, conversations]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? (JSON.parse(saved) as Conversation[]) : [];
    if (parsed.length > 0) {
      setConversations(parsed);
      setActiveId(parsed[0].id);
      return;
    }

    const first = createConversation();
    setConversations([first]);
    setActiveId(first.id);
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      window.localStorage.setItem(storageKey, JSON.stringify(conversations));
    }
  }, [conversations]);

  function startConversation() {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setMessage("");
    setError(null);
  }

  function renameConversation() {
    if (!activeConversation) return;
    const title = message.trim() || activeConversation.messages[0]?.content.slice(0, 42) || "New conversation";
    setConversations((current) =>
      current.map((conversation) => (conversation.id === activeConversation.id ? { ...conversation, title } : conversation))
    );
  }

  function deleteConversation() {
    if (!activeConversation) return;
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== activeConversation.id);
      if (next.length === 0) {
        const fresh = createConversation();
        setActiveId(fresh.id);
        return [fresh];
      }

      setActiveId(next[0].id);
      return next;
    });
  }

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed || !activeConversation) return;

    setIsSending(true);
    setError(null);
    setMessage("");

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const messagesAfterUser = [...activeConversation.messages, userMessage];
    updateActiveMessages(messagesAfterUser);

    try {
      const response = await fetch("/api/workflows/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, context, knowledgeSource })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Chat generation failed.");
        return;
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: formatChatResponse(payload.data)
      };

      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== activeConversation.id) return conversation;
          const title = conversation.messages.length === 0 ? trimmed.slice(0, 42) : conversation.title;
          return { ...conversation, title, messages: [...messagesAfterUser, assistantMessage] };
        })
      );
    } catch {
      setError("Chat generation failed. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function updateActiveMessages(messages: ChatMessage[]) {
    if (!activeConversation) return;
    setConversations((current) =>
      current.map((conversation) => (conversation.id === activeConversation.id ? { ...conversation, messages } : conversation))
    );
  }

  async function copyConversation() {
    if (!activeConversation) return;
    await navigator.clipboard.writeText(activeConversation.messages.map((item) => `${item.role}: ${item.content}`).join("\n\n"));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Conversations</h2>
          <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium" type="button" onClick={startConversation}>
            New
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`rounded-md px-3 py-2 text-left text-sm ${
                conversation.id === activeConversation?.id ? "bg-leaf text-white" : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
              }`}
              type="button"
              onClick={() => setActiveId(conversation.id)}
            >
              {conversation.title}
            </button>
          ))}
        </div>
      </aside>

      <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <h2 className="font-semibold text-ink">{activeConversation?.title ?? "Conversation"}</h2>
            <p className="mt-1 text-sm text-neutral-500">Backend-protected Markitome AI chat for internal work.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium" type="button" onClick={renameConversation}>
              Rename
            </button>
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium" type="button" onClick={copyConversation}>
              Copy
            </button>
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-red-700" type="button" onClick={deleteConversation}>
              Delete
            </button>
          </div>
        </div>

        <div className="grid min-h-96 gap-3 rounded-md bg-neutral-50 p-4">
          {activeConversation?.messages.length ? (
            activeConversation.messages.map((item) => (
              <div key={item.id} className={`max-w-3xl rounded-lg p-3 text-sm leading-6 ${item.role === "user" ? "ml-auto bg-ink text-white" : "bg-white text-neutral-700 shadow-sm"}`}>
                <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center text-center text-sm text-neutral-500">
              Ask about proposals, research, blogs, presentations, emails, SOPs, or internal tasks.
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Context">
            <TextInput value={context} onChange={(event) => setContext(event.target.value)} />
          </Field>
          <Field label="Knowledge source">
            <TextInput value={knowledgeSource} onChange={(event) => setKnowledgeSource(event.target.value)} />
          </Field>
        </div>
        <Field label="Message">
          <TextArea value={message} onChange={(event) => setMessage(event.target.value)} />
        </Field>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <div className="flex justify-end">
          <Button onClick={sendMessage} disabled={isSending || !message.trim()}>
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    messages: []
  };
}

function formatChatResponse(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const response = typeof record.response === "string" ? record.response : typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const actions = Array.isArray(record.suggestedActions) ? record.suggestedActions : [];
  const references = Array.isArray(record.sourceReferences) ? record.sourceReferences : [];

  return [
    response,
    actions.length ? `Suggested actions:\n${actions.map((item) => `- ${String(item)}`).join("\n")}` : "",
    references.length ? `Sources:\n${references.map((item) => `- ${String(item)}`).join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}
