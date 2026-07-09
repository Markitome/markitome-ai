import {
  blogPrompt,
  emailPrompt,
  imageStudioPrompt,
  knowledgePrompt,
  presentationPrompt,
  proposalPrompt
} from "@markitome/prompts";
import type {
  BlogInput,
  BlogOutput,
  ChatImageOptions,
  ChatInput,
  ChatOutput,
  ChatTextProvider,
  ChatVideoOptions,
  EmailInput,
  EmailOutput,
  ImageStudioInput,
  ImageStudioOutput,
  KnowledgeInput,
  KnowledgeOutput,
  PresentationInput,
  PresentationOutput,
  ProjectFileInput,
  ProposalInput,
  ProposalOutput
} from "@markitome/shared";
import {
  buildProposalPricing,
  generateProposalFileName,
  proposalAcceptanceText,
  proposalContactInfo,
  proposalGstNote,
  proposalOnActualsNote,
  proposalTermsAndConditions
} from "@markitome/shared";

export const DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
export const DEFAULT_ANTHROPIC_TEXT_MODEL = "claude-sonnet-5";
export const DEFAULT_NANO_BANANA_MODEL = "gemini-3.1-flash-image";
export const DEFAULT_SEEDANCE_ENDPOINT = "bytedance/seedance-2.0/text-to-video";
export const DEFAULT_CLOUDFLARE_TEXT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

type TextProvider = ChatTextProvider | "auto" | "cloudflare";

type ProviderTextResult = {
  text: string;
  provider: string;
  model?: string;
  placeholder?: boolean;
  raw?: unknown;
};

type ImageGenerationResult = {
  imageUrl: string | null;
  imageBase64: string | null;
  mimeType: string;
  model: string;
  provider: string;
  placeholder?: boolean;
  prompt?: string;
  message?: string;
  raw?: unknown;
};

type VideoGenerationResult = {
  provider: string;
  videoUrl: string | null;
  requestId: string | null;
  status: string | null;
  placeholder?: boolean;
  message?: string;
  raw?: unknown;
};

export type ModelTask = "text" | "structured" | "image" | "embedding";

export function routeModel(task: ModelTask) {
  const configuredTextModel = process.env.CLOUDFLARE_TEXT_MODEL;

  if (task === "text" || task === "structured") {
    return configuredTextModel ?? DEFAULT_CLOUDFLARE_TEXT_MODEL;
  }

  return DEFAULT_CLOUDFLARE_TEXT_MODEL;
}

type WorkersAIRequest = {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

type TextGenerationOptions = {
  provider?: TextProvider;
  system?: string;
};

export async function callWorkersAI<T = unknown>(request: WorkersAIRequest): Promise<T> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = request.model ?? routeModel("text");

  const bindingResponse = await callWorkersAIBinding(model, request.messages);
  if (bindingResponse) {
    return bindingResponse as T;
  }

  if (!accountId || !apiToken) {
    return {
      placeholder: true,
      model,
      message: "Cloudflare Workers AI credentials are not configured."
    } as T;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages: request.messages })
    }
  );

  if (!response.ok) {
    throw new Error(`Workers AI request failed with status ${response.status}`);
  }

  return normalizeWorkersAIResponse(await response.json()) as T;
}

export async function generateText(prompt: string, options: TextGenerationOptions = {}) {
  const result = await callTextModel(prompt, {
    provider: options.provider ?? normalizeTextProvider(process.env.TEXT_MODEL_PROVIDER) ?? "openai",
    system: options.system ?? "You are Markitome AI, a precise internal marketing workspace assistant."
  });

  return {
    result: { response: result.text },
    provider: result.provider,
    model: result.model,
    placeholder: result.placeholder
  };
}

export async function generateStructuredOutput<T>(prompt: string): Promise<T> {
  const response = await generateText(`${prompt}\nReturn valid JSON only.`, {
    provider: normalizeTextProvider(process.env.STRUCTURED_TEXT_PROVIDER) ?? normalizeTextProvider(process.env.TEXT_MODEL_PROVIDER) ?? "openai"
  });

  if ("placeholder" in response && response.placeholder) {
    return response as T;
  }

  const text = response.result?.response ?? "{}";
  return JSON.parse(extractJson(text)) as T;
}

export async function generateImage(prompt: string, options: ChatImageOptions = {}): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NANO_BANANA_API_KEY;
  const model = process.env.NANO_BANANA_IMAGE_MODEL ?? DEFAULT_NANO_BANANA_MODEL;
  const mimeType = "image/png";

  if (!apiKey) {
    return {
      imageUrl: null,
      imageBase64: null,
      mimeType,
      model,
      provider: "gemini-nano-banana",
      placeholder: true,
      prompt,
      message: "GEMINI_API_KEY or NANO_BANANA_API_KEY is not configured."
    };
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [{ type: "text", text: prompt }],
      response_format: {
        type: "image",
        mime_type: mimeType,
        aspect_ratio: options.aspectRatio ?? "1:1",
        image_size: options.imageSize ?? "1K"
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Nano Banana request failed with status ${response.status}: ${stringifyErrorPayload(payload)}`);
  }

  const image = extractGeminiImage(payload);
  if (!image?.data) {
    throw new Error("Nano Banana response did not include image data.");
  }

  const outputMimeType = image.mimeType ?? mimeType;
  return {
    imageUrl: `data:${outputMimeType};base64,${image.data}`,
    imageBase64: image.data,
    mimeType: outputMimeType,
    model,
    provider: "gemini-nano-banana",
    placeholder: false,
    prompt,
    raw: payload
  };
}

export async function createEmbedding(text: string) {
  return {
    vector: [],
    textLength: text.length,
    TODO: "Connect to Cloudflare Vectorize or OpenAI embeddings when persistent knowledge retrieval is enabled."
  };
}

export async function searchVectorize(query: string) {
  return {
    matches: [],
    query,
    TODO: "Use CLOUDFLARE_VECTORIZE_INDEX once credentials and schema are configured."
  };
}

export async function generateProposal(input: ProposalInput): Promise<ProposalOutput> {
  const fileName = generateProposalFileName(input);
  const pricing = buildProposalPricing(input.requiredServices, input.discountPercent);

  return generateWithFallback<ProposalOutput>(proposalPrompt(input), {
    proposalNumber: fileName,
    fileName,
    clientName: input.clientName,
    clientUrl: input.clientWebsite,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    clientAddress: input.clientAddress,
    proposalTitle: `${input.clientName} Growth Proposal`,
    executiveSummary: `A launch-ready proposal draft for ${input.clientName}, focused on ${input.proposalObjective}.`,
    clientUnderstanding: `${input.clientName} needs a practical, measurable marketing plan for ${input.industry || "its market"}.`,
    scopeOfServices: input.requiredServices.split(",").map((service) => service.trim()).filter(Boolean),
    deliverables: ["Discovery workshop", "Strategy roadmap", "Execution plan", "Performance reporting"],
    timeline: input.timeline,
    commercialStructure: `Subtotal ${pricing.pricingSummary.subtotal}; discount ${pricing.pricingSummary.discountPercent}%; total after discount ${pricing.pricingSummary.totalAfterDiscount}.`,
    pricingTable: pricing.pricingTable,
    pricingSummary: pricing.pricingSummary,
    taxAndActualsNotes: [proposalGstNote, proposalOnActualsNote],
    termsAndConditions: proposalTermsAndConditions,
    acceptance: proposalAcceptanceText,
    contactInformation: proposalContactInfo,
    nextSteps: ["Confirm scope", "Approve commercials", "Schedule kickoff"]
  });
}

export async function generateChatResponse(input: ChatInput): Promise<ChatOutput> {
  const mode = input.mode ?? "text";

  if (mode === "image") {
    return generateChatImage(input);
  }

  if (mode === "video") {
    return generateChatVideo(input);
  }

  const provider = normalizeTextProvider(input.textProvider) ?? normalizeTextProvider(process.env.TEXT_MODEL_PROVIDER) ?? "openai";
  const prompt = buildChatAssistantPrompt(input);

  try {
    const result = await callTextModel(prompt, {
      provider,
      system: "You are Markitome AI, an internal assistant for marketing, client work, research, operations, and project execution. Use supplied project files as grounding context when relevant."
    });

    return {
      mode: "text",
      provider: result.provider,
      response: result.text,
      suggestedActions: ["Turn this into a client-ready draft", "Save useful facts into a project file", "Ask for a shorter action list"],
      sourceReferences: buildSourceReferences(input)
    };
  } catch (error) {
    return {
      mode: "text",
      provider,
      response: `I could not generate a text response because ${getErrorMessage(error)}`,
      suggestedActions: ["Check the selected provider API key", "Try the other text provider", "Verify Cloudflare runtime secrets"],
      sourceReferences: buildSourceReferences(input)
    };
  }
}

export async function generateBlog(input: BlogInput): Promise<BlogOutput> {
  return generateWithFallback<BlogOutput>(blogPrompt(input), {
    seoTitle: `${input.topic} for ${input.clientName}`,
    metaTitle: `${input.topic} | ${input.clientName}`,
    metaDescription: `A ${input.tone || "professional"} guide to ${input.topic}, optimized for ${input.targetKeyword}.`,
    slug: input.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    blogOutline: ["Introduction", "Core problem", "Recommended approach", "Implementation checklist", "Conclusion"],
    fullArticle: `Draft placeholder for ${input.clientName}: ${input.topic}. Target keyword: ${input.targetKeyword}.`,
    fullBlogDraft: `Draft placeholder for ${input.clientName}: ${input.topic}. Target keyword: ${input.targetKeyword}.`,
    faqs: [
      { question: `Why does ${input.topic} matter?`, answer: "It helps the audience understand the business value and next step." },
      { question: "How should this be implemented?", answer: "Start with a clear strategy, then refine with performance data." }
    ],
    internalLinkingSuggestions: ["Link to the client services page", "Link to a related case study", "Link to the contact page"],
    schemaFriendlyStructure: ["Article", "FAQPage", "BreadcrumbList"]
  });
}

export async function generatePresentation(input: PresentationInput): Promise<PresentationOutput> {
  const count = Math.max(1, Number.parseInt(input.numberOfSlides, 10) || 5);

  const slideTitles = Array.from({ length: count }, (_, index) => `Slide ${index + 1}: ${index === 0 ? input.topic : "Key recommendation"}`);

  return generateWithFallback<PresentationOutput>(presentationPrompt(input), {
    slideTitles,
    slideWiseContent: slideTitles.map((title) => ({
      title,
      content: ["Core message", "Supporting point", "Recommended action"]
    })),
    speakerNotes: slideTitles.map((title) => `Presenter note for ${title}.`),
    suggestedVisuals: ["Client context visual", "Process diagram", "Performance chart"],
    ctaSlide: "Next steps and kickoff approval",
    googleSlidesDraftPlaceholder: "Google Slides creation placeholder. Configure Slides API scopes before enabling."
  });
}

export async function generateImageStudioBrief(input: ImageStudioInput): Promise<ImageStudioOutput> {
  return generateWithFallback<ImageStudioOutput>(imageStudioPrompt(input), {
    generatedImagePlaceholder: "Image generation placeholder. Backend-only provider call will be added after model approval.",
    imageUrl: null,
    promptUsed: `${input.format} for ${input.platform}. ${input.imageDescription}. Brand colors: ${input.brandColors}. Text: ${input.textOverlay}.`,
    captionOptions: [
      `A crisp campaign caption for ${input.platform}.`,
      `A conversion-focused caption tied to ${input.campaignObjective}.`,
      "A short brand-safe social caption."
    ],
    designerNotes: ["Keep text legible at mobile sizes", "Respect brand color contrast", "Export platform-specific dimensions"]
  });
}

export async function generateEmailDraft(input: EmailInput): Promise<EmailOutput> {
  return generateWithFallback<EmailOutput>(emailPrompt(input), {
    emailSubject: input.purpose,
    emailBody: `Hi,\n\nThanks for the context. ${input.keyPoints}\n\n${input.desiredCta}\n\nBest,\nMarkitome Team`,
    shortFollowUpVersion: `Following up on ${input.purpose}. Happy to align on the next step.`,
    whatsappVersion: `Hi, quick update on ${input.purpose}: ${input.keyPoints}`
  });
}

export async function generateKnowledgeSummary(input: KnowledgeInput): Promise<KnowledgeOutput> {
  return generateWithFallback<KnowledgeOutput>(knowledgePrompt(input), {
    indexedDocument: input.title,
    vectorIds: [],
    searchPreview: input.content.split(".").map((item) => item.trim()).filter(Boolean).slice(0, 3),
    auditTrail: "Placeholder ingestion completed without embedding because Cloudflare credentials are not configured."
  });
}

async function generateChatImage(input: ChatInput): Promise<ChatOutput> {
  try {
    const result = await generateImage(buildCreativePrompt(input), input.imageOptions);

    return {
      mode: "image",
      provider: result.provider,
      response: result.placeholder ? result.message ?? "Image provider is not configured." : "Image generated.",
      suggestedActions: result.placeholder ? ["Set GEMINI_API_KEY in Cloudflare secrets"] : ["Download the image", "Generate a variation", "Save the prompt in project files"],
      sourceReferences: buildSourceReferences(input),
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      imageMimeType: result.mimeType
    };
  } catch (error) {
    return {
      mode: "image",
      provider: "gemini-nano-banana",
      response: `I could not generate an image because ${getErrorMessage(error)}`,
      suggestedActions: ["Check GEMINI_API_KEY", "Try a simpler prompt", "Verify the Nano Banana model name"],
      sourceReferences: buildSourceReferences(input),
      imageUrl: null
    };
  }
}

async function generateChatVideo(input: ChatInput): Promise<ChatOutput> {
  try {
    const result = await generateVideo(buildCreativePrompt(input), input.videoOptions);

    return {
      mode: "video",
      provider: result.provider,
      response: result.placeholder
        ? result.message ?? "Video provider is not configured."
        : result.videoUrl
          ? "Video generated."
          : "Video generation was submitted and is still processing.",
      suggestedActions: result.videoUrl ? ["Review the clip", "Generate a shorter variant", "Save the prompt in project files"] : ["Check status later", "Use a shorter duration", "Try the fast Seedance endpoint"],
      sourceReferences: buildSourceReferences(input),
      videoUrl: result.videoUrl,
      requestId: result.requestId,
      status: result.status,
      raw: result.raw
    };
  } catch (error) {
    return {
      mode: "video",
      provider: "seedance-2.0",
      response: `I could not generate a video because ${getErrorMessage(error)}`,
      suggestedActions: ["Check FAL_KEY or SEEDANCE_API_KEY", "Verify the Seedance endpoint", "Try a 5 second 720p prompt"],
      sourceReferences: buildSourceReferences(input),
      videoUrl: null
    };
  }
}

async function generateWithFallback<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const output = await generateStructuredOutput<T>(prompt);
    if (isPlaceholderResponse(output)) {
      return fallback;
    }

    return output;
  } catch (error) {
    console.error("Markitome AI generation failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return fallback;
  }
}

async function callTextModel(prompt: string, options: Required<TextGenerationOptions>): Promise<ProviderTextResult> {
  const provider = normalizeTextProvider(options.provider) ?? "auto";

  if (provider === "openai") return callOpenAIText(prompt, options.system);
  if (provider === "claude") return callAnthropicText(prompt, options.system);
  if (provider === "compare") return compareTextModels(prompt, options.system);
  if (provider === "cloudflare") return callCloudflareText(prompt, options.system);

  if (process.env.OPENAI_API_KEY) return callOpenAIText(prompt, options.system);
  if (process.env.ANTHROPIC_API_KEY) return callAnthropicText(prompt, options.system);
  return callCloudflareText(prompt, options.system);
}

async function callOpenAIText(prompt: string, system: string): Promise<ProviderTextResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: prompt,
      store: false
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}: ${stringifyErrorPayload(payload)}`);
  }

  return {
    text: extractOpenAIText(payload),
    provider: "openai",
    model,
    raw: payload
  };
}

async function callAnthropicText(prompt: string, system: string): Promise<ProviderTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_TEXT_MODEL ?? DEFAULT_ANTHROPIC_TEXT_MODEL;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: Number.parseInt(process.env.ANTHROPIC_MAX_TOKENS ?? "4096", 10),
      messages: [{ role: "user", content: prompt }]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Claude request failed with status ${response.status}: ${stringifyErrorPayload(payload)}`);
  }

  return {
    text: extractAnthropicText(payload),
    provider: "claude",
    model,
    raw: payload
  };
}

async function compareTextModels(prompt: string, system: string): Promise<ProviderTextResult> {
  const calls: Array<Promise<ProviderTextResult>> = [];
  if (process.env.OPENAI_API_KEY) calls.push(callOpenAIText(prompt, system));
  if (process.env.ANTHROPIC_API_KEY) calls.push(callAnthropicText(prompt, system));

  if (calls.length === 0) {
    throw new Error("OPENAI_API_KEY or ANTHROPIC_API_KEY must be configured for compare mode.");
  }

  const settled = await Promise.allSettled(calls);
  const successes = settled
    .filter((item): item is PromiseFulfilledResult<ProviderTextResult> => item.status === "fulfilled")
    .map((item) => item.value);

  if (successes.length === 0) {
    const firstError = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
    throw new Error(getErrorMessage(firstError?.reason ?? "Both providers failed."));
  }

  return {
    text: successes.map((item) => `${providerLabel(item.provider)}\n${item.text}`).join("\n\n---\n\n"),
    provider: successes.map((item) => item.provider).join("+"),
    model: successes.map((item) => item.model).filter(Boolean).join("+")
  };
}

async function callCloudflareText(prompt: string, system: string): Promise<ProviderTextResult> {
  const response = await callWorkersAI<{ result?: { response?: string }; placeholder?: boolean; model?: string; message?: string }>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ]
  });

  return {
    text: response.result?.response ?? response.message ?? "Cloudflare Workers AI is not configured.",
    provider: "cloudflare-workers-ai",
    model: response.model ?? routeModel("text"),
    placeholder: response.placeholder
  };
}

async function generateVideo(prompt: string, options: ChatVideoOptions = {}): Promise<VideoGenerationResult> {
  const apiKey = process.env.FAL_KEY ?? process.env.SEEDANCE_API_KEY;
  const endpoint = cleanEndpoint(options.endpoint ?? process.env.SEEDANCE_ENDPOINT ?? DEFAULT_SEEDANCE_ENDPOINT);

  if (!apiKey) {
    return {
      provider: "seedance-2.0",
      videoUrl: null,
      requestId: null,
      status: "not_configured",
      placeholder: true,
      message: "FAL_KEY or SEEDANCE_API_KEY is not configured."
    };
  }

  const input = cleanObject({
    prompt,
    duration: options.duration ?? process.env.SEEDANCE_DEFAULT_DURATION ?? "5",
    resolution: options.resolution ?? process.env.SEEDANCE_DEFAULT_RESOLUTION ?? "720p",
    aspect_ratio: options.aspectRatio ?? process.env.SEEDANCE_DEFAULT_ASPECT_RATIO ?? "16:9"
  });

  const submitResponse = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const submitPayload = await submitResponse.json();
  if (!submitResponse.ok) {
    throw new Error(`Seedance request failed with status ${submitResponse.status}: ${stringifyErrorPayload(submitPayload)}`);
  }

  const requestId = stringValue((submitPayload as Record<string, unknown>).request_id) ?? stringValue((submitPayload as Record<string, unknown>).requestId);
  const immediateVideoUrl = extractVideoUrl(submitPayload);
  if (!requestId || immediateVideoUrl) {
    return {
      provider: "seedance-2.0",
      videoUrl: immediateVideoUrl,
      requestId: requestId ?? null,
      status: immediateVideoUrl ? "COMPLETED" : "SUBMITTED",
      placeholder: false,
      raw: submitPayload
    };
  }

  const pollSeconds = Math.min(110, Math.max(0, Number.parseInt(process.env.SEEDANCE_POLL_SECONDS ?? "45", 10)));
  const deadline = Date.now() + pollSeconds * 1000;
  let latestStatus: unknown = submitPayload;

  while (Date.now() < deadline) {
    await delay(4000);
    const statusResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status?logs=1`, {
      headers: { Authorization: `Key ${apiKey}` }
    });
    latestStatus = await statusResponse.json();

    const status = stringValue((latestStatus as Record<string, unknown>).status);
    if (status === "COMPLETED") {
      const resultResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
        headers: { Authorization: `Key ${apiKey}` }
      });
      const resultPayload = await resultResponse.json();
      if (!resultResponse.ok) {
        throw new Error(`Seedance result request failed with status ${resultResponse.status}: ${stringifyErrorPayload(resultPayload)}`);
      }

      return {
        provider: "seedance-2.0",
        videoUrl: extractVideoUrl(resultPayload),
        requestId,
        status,
        placeholder: false,
        raw: resultPayload
      };
    }
  }

  return {
    provider: "seedance-2.0",
    videoUrl: null,
    requestId,
    status: stringValue((latestStatus as Record<string, unknown>).status) ?? "SUBMITTED",
    placeholder: false,
    raw: latestStatus
  };
}

function buildChatAssistantPrompt(input: ChatInput) {
  return [
    "Answer the user's latest request in a ChatGPT-like conversational style.",
    "Use the project files only when they are relevant. If a file does not support an answer, do not pretend that it does.",
    input.context.trim() ? `Context:\n${input.context.trim()}` : "",
    input.knowledgeSource.trim() ? `Knowledge source:\n${input.knowledgeSource.trim()}` : "",
    formatHistory(input.history),
    formatProjectFiles(input.projectFiles),
    `User request:\n${input.message}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildCreativePrompt(input: ChatInput) {
  return [
    input.context.trim() ? `Campaign context: ${input.context.trim()}` : "",
    formatProjectFiles(input.projectFiles),
    input.knowledgeSource.trim() ? `Reference source: ${input.knowledgeSource.trim()}` : "",
    `Creative request: ${input.message}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildSourceReferences(input: ChatInput) {
  const references = [input.knowledgeSource, ...(input.projectFiles ?? []).map((file) => file.title)]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(references));
}

function formatProjectFiles(files: ProjectFileInput[] | undefined) {
  const usableFiles = files?.filter((file) => file.title.trim() && file.content.trim()).slice(0, 8) ?? [];
  if (usableFiles.length === 0) return "";

  return [
    "Project files:",
    usableFiles
      .map((file, index) => {
        const content = file.content.length > 8000 ? `${file.content.slice(0, 8000)}\n[truncated]` : file.content;
        return `File ${index + 1}: ${file.title}\n${content}`;
      })
      .join("\n\n---\n\n")
  ].join("\n");
}

function formatHistory(history: ChatInput["history"]) {
  const items = history?.slice(-10) ?? [];
  if (items.length === 0) return "";
  return ["Recent conversation:", ...items.map((item) => `${item.role}: ${item.content}`)].join("\n");
}

function normalizeTextProvider(value: unknown): TextProvider | undefined {
  if (value === "openai" || value === "claude" || value === "compare" || value === "auto" || value === "cloudflare") return value;
  return undefined;
}

function providerLabel(provider: string) {
  if (provider === "openai") return "OpenAI";
  if (provider === "claude") return "Claude";
  return provider;
}

function isPlaceholderResponse(value: unknown) {
  return Boolean(value && typeof value === "object" && "placeholder" in value);
}

async function callWorkersAIBinding(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    const ai = (context.env as Record<string, unknown>).AI as
      | { run: (model: string, input: unknown) => Promise<unknown> }
      | undefined;

    if (!ai) {
      return null;
    }

    return normalizeWorkersAIResponse(await ai.run(model, { messages }));
  } catch {
    return null;
  }
}

function normalizeWorkersAIResponse(result: unknown) {
  const text = extractWorkersAIText(result);
  return { result: { response: text } };
}

function extractWorkersAIText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";

  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;

  const nestedResult = record.result;
  if (nestedResult && nestedResult !== result) {
    const nestedText = extractWorkersAIText(nestedResult);
    if (nestedText) return nestedText;
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    if (typeof first.text === "string") return first.text;
    const message = first.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === "string") return message.content;
  }

  return JSON.stringify(result);
}

function extractOpenAIText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;

  const output = record.output;
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const blockRecord = block as Record<string, unknown>;
        if (typeof blockRecord.text === "string") parts.push(blockRecord.text);
      }
    }

    if (parts.length > 0) return parts.join("\n");
  }

  return JSON.stringify(result);
}

function extractAnthropicText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as Record<string, unknown>).content;
  if (!Array.isArray(content)) return JSON.stringify(result);

  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractGeminiImage(value: unknown): { data: string; mimeType?: string } | null {
  const direct = readImageBlock(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = extractGeminiImage(item);
      if (image) return image;
    }
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const image = extractGeminiImage(item);
      if (image) return image;
    }
  }

  return null;
}

function readImageBlock(value: unknown): { data: string; mimeType?: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const data = stringValue(record.data) ?? stringValue(record.b64_json) ?? stringValue(record.image_base64);
  const mimeType = stringValue(record.mime_type) ?? stringValue(record.mimeType) ?? "image/png";

  if (data && (record.type === "image" || record.type === "output_image" || record.mime_type || record.mimeType || record.b64_json)) {
    return { data, mimeType };
  }

  const outputImage = record.output_image;
  if (outputImage && outputImage !== value) return readImageBlock(outputImage);

  return null;
}

function extractVideoUrl(value: unknown): string | null {
  if (typeof value === "string") return value.endsWith(".mp4") || value.includes(".mp4?") ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractVideoUrl(item);
      if (url) return url;
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const video = record.video;
    if (video && typeof video === "object") {
      const url = stringValue((video as Record<string, unknown>).url);
      if (url) return url;
    }

    const url = stringValue(record.url);
    if (url && (url.endsWith(".mp4") || url.includes(".mp4?") || record.content_type === "video/mp4")) return url;

    for (const item of Object.values(record)) {
      const nested = extractVideoUrl(item);
      if (nested) return nested;
    }
  }

  return null;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1);
  }

  return trimmed;
}

function cleanEndpoint(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function cleanObject(value: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => Boolean(item)));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stringifyErrorPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
