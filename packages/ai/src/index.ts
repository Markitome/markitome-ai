import {
  blogPrompt,
  chatPrompt,
  emailPrompt,
  imageStudioPrompt,
  knowledgePrompt,
  presentationPrompt,
  proposalPrompt
} from "@markitome/prompts";
import type {
  BlogInput,
  BlogOutput,
  ChatInput,
  ChatOutput,
  EmailInput,
  EmailOutput,
  ImageStudioInput,
  ImageStudioOutput,
  KnowledgeInput,
  KnowledgeOutput,
  PresentationInput,
  PresentationOutput,
  ProposalInput,
  ProposalOutput
} from "@markitome/shared";

export const DEFAULT_TEXT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export type ModelTask = "text" | "structured" | "image" | "embedding";

export function routeModel(task: ModelTask) {
  const configuredTextModel = process.env.CLOUDFLARE_TEXT_MODEL;

  if (task === "text" || task === "structured") {
    return configuredTextModel ?? DEFAULT_TEXT_MODEL;
  }

  // TODO: Add approved image and embedding model IDs when those workflows move beyond placeholders.
  return DEFAULT_TEXT_MODEL;
}

type WorkersAIRequest = {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

export async function callWorkersAI<T = unknown>(request: WorkersAIRequest): Promise<T> {
  // TODO: Configure Cloudflare API credentials in server-only environment variables or Cloudflare secrets.
  // TODO: Add AI Gateway routing, retry policy, tracing, and model fallback rules before production launch.
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = request.model ?? routeModel("text");

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

  return (await response.json()) as T;
}

export async function generateText(prompt: string) {
  return callWorkersAI<{ result?: { response?: string }; placeholder?: boolean }>({
    messages: [
      { role: "system", content: "You are Markitome AI, a precise internal marketing workspace assistant." },
      { role: "user", content: prompt }
    ]
  });
}

export async function generateStructuredOutput<T>(prompt: string): Promise<T> {
  const response = await generateText(`${prompt}\nReturn valid JSON only.`);
  if ("placeholder" in response && response.placeholder) {
    return response as T;
  }

  const text = response.result?.response ?? "{}";
  return JSON.parse(text) as T;
}

export async function generateImage(prompt: string) {
  // TODO: Connect to an approved Cloudflare image model or image provider through the backend only.
  return {
    imageUrl: null,
    prompt,
    TODO: "Connect to an approved Cloudflare image model or image provider through the backend only."
  };
}

export async function createEmbedding(text: string) {
  // TODO: Connect to a Cloudflare embedding model and store vectors in Vectorize.
  return {
    vector: [],
    textLength: text.length,
    TODO: "Connect to Cloudflare embedding model and never send secrets to the frontend."
  };
}

export async function searchVectorize(query: string) {
  // TODO: Use CLOUDFLARE_VECTORIZE_INDEX once credentials and retrieval schema are configured.
  return {
    matches: [],
    query,
    TODO: "Use CLOUDFLARE_VECTORIZE_INDEX once credentials and schema are configured."
  };
}

export async function generateProposal(input: ProposalInput): Promise<ProposalOutput> {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    return {
      proposalTitle: `${input.clientName} Growth Proposal`,
      executiveSummary: `A placeholder proposal for ${input.clientName}, focused on ${input.proposalObjective}.`,
      scopeOfServices: input.requiredServices.split(",").map((service) => service.trim()).filter(Boolean),
      deliverables: ["Discovery workshop", "Strategy roadmap", "Execution plan", "Performance reporting"],
      timeline: input.timeline,
      commercialStructure: input.budgetRange,
      termsAndConditions: ["Final scope subject to discovery.", "Commercials exclude third-party media and tool costs."],
      nextSteps: ["Confirm scope", "Approve commercials", "Schedule kickoff"]
    };
  }

  return generateStructuredOutput<ProposalOutput>(proposalPrompt(input));
}

export async function generateChatResponse(input: ChatInput): Promise<ChatOutput> {
  if (!hasWorkersAIConfig()) {
    return {
      response: `Here is a practical starting point: ${input.message}`,
      suggestedActions: ["Clarify the desired outcome", "Collect any client-specific context", "Turn the result into a reusable workflow"],
      sourceReferences: input.knowledgeSource ? [input.knowledgeSource] : []
    };
  }

  return generateStructuredOutput<ChatOutput>(chatPrompt(input));
}

export async function generateBlog(input: BlogInput): Promise<BlogOutput> {
  if (!hasWorkersAIConfig()) {
    return {
      seoTitle: `${input.topic} for ${input.clientName}`,
      metaTitle: `${input.topic} | ${input.clientName}`,
      metaDescription: `A ${input.tone || "professional"} guide to ${input.topic}, optimized for ${input.targetKeyword}.`,
      blogOutline: ["Introduction", "Core problem", "Recommended approach", "Implementation checklist", "Conclusion"],
      fullBlogDraft: `Draft placeholder for ${input.clientName}: ${input.topic}. Target keyword: ${input.targetKeyword}.`,
      faqs: [
        { question: `Why does ${input.topic} matter?`, answer: "It helps the audience understand the business value and next step." },
        { question: "How should this be implemented?", answer: "Start with a clear strategy, then refine with performance data." }
      ],
      schemaFriendlyStructure: ["Article", "FAQPage", "BreadcrumbList"]
    };
  }

  return generateStructuredOutput<BlogOutput>(blogPrompt(input));
}

export async function generatePresentation(input: PresentationInput): Promise<PresentationOutput> {
  const count = Math.max(1, Number.parseInt(input.numberOfSlides, 10) || 5);

  if (!hasWorkersAIConfig()) {
    const slideTitles = Array.from({ length: count }, (_, index) => `Slide ${index + 1}: ${index === 0 ? input.topic : "Key recommendation"}`);
    return {
      slideTitles,
      slideWiseContent: slideTitles.map((title) => ({
        title,
        content: ["Core message", "Supporting point", "Recommended action"]
      })),
      speakerNotes: slideTitles.map((title) => `Presenter note for ${title}.`),
      suggestedVisuals: ["Client context visual", "Process diagram", "Performance chart"],
      googleSlidesDraftPlaceholder: "Google Slides creation placeholder. Configure Slides API scopes before enabling."
    };
  }

  return generateStructuredOutput<PresentationOutput>(presentationPrompt(input));
}

export async function generateImageStudioBrief(input: ImageStudioInput): Promise<ImageStudioOutput> {
  if (!hasWorkersAIConfig()) {
    return {
      generatedImagePlaceholder: "Image generation placeholder. Backend-only provider call will be added after model approval.",
      promptUsed: `${input.format} for ${input.platform}. ${input.imageDescription}. Brand colors: ${input.brandColors}. Text: ${input.textOverlay}.`,
      captionOptions: [
        `A crisp campaign caption for ${input.platform}.`,
        `A conversion-focused caption tied to ${input.campaignObjective}.`,
        "A short brand-safe social caption."
      ],
      designerNotes: ["Keep text legible at mobile sizes", "Respect brand color contrast", "Export platform-specific dimensions"]
    };
  }

  return generateStructuredOutput<ImageStudioOutput>(imageStudioPrompt(input));
}

export async function generateEmailDraft(input: EmailInput): Promise<EmailOutput> {
  if (!hasWorkersAIConfig()) {
    return {
      emailSubject: input.purpose,
      emailBody: `Hi,\n\nThanks for the context. ${input.keyPoints}\n\nBest,\nMarkitome Team`,
      shortFollowUpVersion: `Following up on ${input.purpose}. Happy to align on the next step.`,
      whatsappVersion: `Hi, quick update on ${input.purpose}: ${input.keyPoints}`
    };
  }

  return generateStructuredOutput<EmailOutput>(emailPrompt(input));
}

export async function generateKnowledgeSummary(input: KnowledgeInput): Promise<KnowledgeOutput> {
  if (!hasWorkersAIConfig()) {
    return {
      indexedDocument: input.title,
      vectorIds: [],
      searchPreview: input.content.split(".").map((item) => item.trim()).filter(Boolean).slice(0, 3),
      auditTrail: "Placeholder ingestion completed without embedding because Cloudflare credentials are not configured."
    };
  }

  return generateStructuredOutput<KnowledgeOutput>(knowledgePrompt(input));
}

function hasWorkersAIConfig() {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}
