"use client";

import { Button, Field, TextArea, TextInput } from "@markitome/ui";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

type ChatMode = "text" | "image" | "video";
type TextProvider = "openai" | "claude" | "compare";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: ChatMode;
  provider?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  status?: string | null;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

type ProjectFile = {
  id: string;
  title: string;
  content: string;
  source?: string;
  selected: boolean;
};

const conversationStorageKey = "markitome-ai-chat-conversations";
const projectFileStorageKey = "markitome-ai-project-files";

export function ChatWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [activeProjectFileId, setActiveProjectFileId] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [knowledgeSource, setKnowledgeSource] = useState("");
  const [mode, setMode] = useState<ChatMode>("text");
  const [textProvider, setTextProvider] = useState<TextProvider>("openai");
  const [imageAspectRatio, setImageAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [videoDuration, setVideoDuration] = useState("5");
  const [videoResolution, setVideoResolution] = useState("720p");
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0],
    [activeId, conversations]
  );

  const selectedProjectFiles = useMemo(
    () => projectFiles.filter((file) => file.selected && file.title.trim() && file.content.trim()),
    [projectFiles]
  );

  useEffect(() => {
    const savedConversations = readStoredArray<Conversation>(conversationStorageKey);
    const initialConversation = savedConversations.length > 0 ? savedConversations : [createConversation()];
    setConversations(initialConversation);
    setActiveId(initialConversation[0].id);

    const savedFiles = readStoredArray<ProjectFile>(projectFileStorageKey).filter(
      (file) => file.id && typeof file.title === "string" && typeof file.content === "string"
    );
    setProjectFiles(savedFiles);
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      window.localStorage.setItem(conversationStorageKey, JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    window.localStorage.setItem(projectFileStorageKey, JSON.stringify(projectFiles));
  }, [projectFiles]);

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

  function newProjectFile() {
    setActiveProjectFileId("");
    setFileTitle("");
    setFileContent("");
  }

  function selectProjectFile(file: ProjectFile) {
    setActiveProjectFileId(file.id);
    setFileTitle(file.title);
    setFileContent(file.content);
  }

  function saveProjectFile() {
    const title = fileTitle.trim();
    const content = fileContent.trim();
    if (!title || !content) return;

    setProjectFiles((current) => {
      if (activeProjectFileId && current.some((file) => file.id === activeProjectFileId)) {
        return current.map((file) => (file.id === activeProjectFileId ? { ...file, title, content, selected: true } : file));
      }

      const file = { id: crypto.randomUUID(), title, content, selected: true };
      setActiveProjectFileId(file.id);
      return [file, ...current];
    });
  }

  function toggleProjectFile(id: string) {
    setProjectFiles((current) => current.map((file) => (file.id === id ? { ...file, selected: !file.selected } : file)));
  }

  function deleteProjectFile(id: string) {
    setProjectFiles((current) => current.filter((file) => file.id !== id));
    if (id === activeProjectFileId) {
      newProjectFile();
    }
  }

  async function importProjectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const imported = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        title: file.name,
        content: (await file.text()).slice(0, 120000),
        source: file.name,
        selected: true
      }))
    );

    setProjectFiles((current) => [...imported, ...current]);
    event.target.value = "";
  }

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed || !activeConversation) return;

    setIsSending(true);
    setError(null);
    setMessage("");

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, mode };
    const messagesAfterUser = [...activeConversation.messages, userMessage];
    updateActiveMessages(messagesAfterUser);

    try {
      const response = await fetch("/api/workflows/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context,
          knowledgeSource,
          mode,
          textProvider,
          projectFiles: selectedProjectFiles.map(({ id, title, content, source }) => ({ id, title, content, source })),
          history: activeConversation.messages.slice(-10).map(({ role, content }) => ({ role, content })),
          imageOptions: { aspectRatio: imageAspectRatio, imageSize },
          videoOptions: { duration: videoDuration, resolution: videoResolution, aspectRatio: videoAspectRatio }
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Chat generation failed.");
        return;
      }

      const record = toRecord(payload.data);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: formatChatResponse(payload.data),
        mode,
        provider: asString(record.provider),
        imageUrl: asString(record.imageUrl),
        videoUrl: asString(record.videoUrl),
        status: asString(record.status)
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
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="grid gap-4 self-start">
        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">Conversations</h2>
            <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium" type="button" onClick={startConversation}>
              New
            </button>
          </div>
          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1">
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
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">Project Files</h2>
            <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium">
              Import
              <input className="hidden" type="file" multiple onChange={importProjectFiles} />
            </label>
          </div>

          <div className="mt-4 grid max-h-48 gap-2 overflow-y-auto pr-1">
            {projectFiles.length ? (
              projectFiles.map((file) => (
                <div key={file.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-neutral-50 px-2 py-2">
                  <input type="checkbox" checked={file.selected} onChange={() => toggleProjectFile(file.id)} />
                  <button className="truncate text-left text-sm font-medium text-neutral-700" type="button" onClick={() => selectProjectFile(file)}>
                    {file.title}
                  </button>
                  <button className="text-xs font-medium text-red-700" type="button" onClick={() => deleteProjectFile(file.id)}>
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-500">No files added.</p>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            <Field label="File name">
              <TextInput value={fileTitle} onChange={(event) => setFileTitle(event.target.value)} />
            </Field>
            <Field label="File content">
              <TextArea value={fileContent} onChange={(event) => setFileContent(event.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium" type="button" onClick={saveProjectFile}>
                {activeProjectFileId ? "Update" : "Add"}
              </button>
              <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium" type="button" onClick={newProjectFile}>
                Clear
              </button>
            </div>
          </div>
        </section>
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
                {item.provider ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{item.provider}</p> : null}
                <p className="whitespace-pre-wrap">{item.content}</p>
                {item.imageUrl ? <img className="mt-3 max-h-[520px] w-full rounded-md object-contain" src={item.imageUrl} alt="Generated result" /> : null}
                {item.videoUrl ? <video className="mt-3 max-h-[520px] w-full rounded-md bg-black" src={item.videoUrl} controls /> : null}
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center text-center text-sm text-neutral-500">
              Ask about proposals, research, blogs, presentations, emails, SOPs, or internal tasks.
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Mode">
            <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={mode} onChange={(event) => setMode(event.target.value as ChatMode)}>
              <option value="text">Text chat</option>
              <option value="image">Generate image</option>
              <option value="video">Generate video</option>
            </select>
          </Field>
          {mode === "text" ? (
            <Field label="Text model">
              <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={textProvider} onChange={(event) => setTextProvider(event.target.value as TextProvider)}>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="compare">OpenAI + Claude</option>
              </select>
            </Field>
          ) : null}
          {mode === "image" ? (
            <>
              <Field label="Aspect">
                <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={imageAspectRatio} onChange={(event) => setImageAspectRatio(event.target.value)}>
                  <option value="1:1">1:1</option>
                  <option value="4:5">4:5</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>
              </Field>
              <Field label="Size">
                <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={imageSize} onChange={(event) => setImageSize(event.target.value)}>
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </Field>
            </>
          ) : null}
          {mode === "video" ? (
            <>
              <Field label="Duration">
                <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={videoDuration} onChange={(event) => setVideoDuration(event.target.value)}>
                  <option value="5">5s</option>
                  <option value="8">8s</option>
                  <option value="10">10s</option>
                  <option value="15">15s</option>
                </select>
              </Field>
              <Field label="Resolution">
                <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={videoResolution} onChange={(event) => setVideoResolution(event.target.value)}>
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                </select>
              </Field>
              <Field label="Aspect">
                <select className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" value={videoAspectRatio} onChange={(event) => setVideoAspectRatio(event.target.value)}>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                  <option value="21:9">21:9</option>
                </select>
              </Field>
            </>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Context">
            <TextInput value={context} onChange={(event) => setContext(event.target.value)} />
          </Field>
          <Field label="Knowledge source">
            <TextInput value={knowledgeSource} onChange={(event) => setKnowledgeSource(event.target.value)} />
          </Field>
        </div>
        <Field label={mode === "text" ? "Message" : "Prompt"}>
          <TextArea value={message} onChange={(event) => setMessage(event.target.value)} />
        </Field>
        {selectedProjectFiles.length ? <p className="text-xs font-medium uppercase tracking-wide text-leaf">{selectedProjectFiles.length} project file{selectedProjectFiles.length === 1 ? "" : "s"} selected</p> : null}
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <div className="flex justify-end">
          <Button onClick={sendMessage} disabled={isSending || !message.trim()}>
            {isSending ? "Sending..." : mode === "text" ? "Send" : "Generate"}
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
  const record = toRecord(value);
  const response = typeof record.response === "string" ? record.response : typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const actions = Array.isArray(record.suggestedActions) ? record.suggestedActions : [];
  const references = Array.isArray(record.sourceReferences) ? record.sourceReferences : [];
  const requestId = asString(record.requestId);
  const status = asString(record.status);

  return [
    response,
    requestId ? `Request: ${requestId}${status ? ` (${status})` : ""}` : "",
    actions.length ? `Suggested actions:\n${actions.map((item) => `- ${String(item)}`).join("\n")}` : "",
    references.length ? `Sources:\n${references.map((item) => `- ${String(item)}`).join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function readStoredArray<T>(key: string): T[] {
  try {
    const saved = window.localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
