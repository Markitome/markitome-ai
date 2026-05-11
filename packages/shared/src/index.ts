export const MARKITOME_EMAIL_DOMAIN = "markitome.com";

export type AppRole = "ADMIN" | "MANAGER" | "TEAM_MEMBER" | "INTERN";

export type ProposalInput = {
  clientName: string;
  clientWebsite: string;
  industry: string;
  requiredServices: string;
  budgetRange: string;
  timeline: string;
  proposalObjective: string;
};

export type ProposalOutput = {
  proposalTitle: string;
  executiveSummary: string;
  scopeOfServices: string[];
  deliverables: string[];
  timeline: string;
  commercialStructure: string;
  termsAndConditions: string[];
  nextSteps: string[];
};

export type ChatInput = {
  message: string;
  context: string;
  knowledgeSource: string;
};

export type ChatOutput = {
  response: string;
  suggestedActions: string[];
  sourceReferences: string[];
};

export type BlogInput = {
  clientName: string;
  website: string;
  topic: string;
  targetKeyword: string;
  tone: string;
  wordCount: string;
};

export type BlogOutput = {
  seoTitle: string;
  metaTitle: string;
  metaDescription: string;
  blogOutline: string[];
  fullBlogDraft: string;
  faqs: Array<{ question: string; answer: string }>;
  schemaFriendlyStructure: string[];
};

export type PresentationInput = {
  clientName: string;
  topic: string;
  objective: string;
  audience: string;
  numberOfSlides: string;
};

export type PresentationOutput = {
  slideTitles: string[];
  slideWiseContent: Array<{ title: string; content: string[] }>;
  speakerNotes: string[];
  suggestedVisuals: string[];
  googleSlidesDraftPlaceholder: string;
};

export type ImageStudioInput = {
  platform: string;
  format: string;
  brandColors: string;
  campaignObjective: string;
  imageDescription: string;
  textOverlay: string;
};

export type ImageStudioOutput = {
  generatedImagePlaceholder: string;
  promptUsed: string;
  captionOptions: string[];
  designerNotes: string[];
};

export type EmailInput = {
  recipientContext: string;
  purpose: string;
  tone: string;
  keyPoints: string;
};

export type EmailOutput = {
  emailSubject: string;
  emailBody: string;
  shortFollowUpVersion: string;
  whatsappVersion: string;
};

export type KnowledgeInput = {
  title: string;
  source: string;
  content: string;
  tags: string;
};

export type KnowledgeOutput = {
  indexedDocument: string;
  vectorIds: string[];
  searchPreview: string[];
  auditTrail: string;
};

export type WorkflowName =
  | "chat"
  | "proposal"
  | "blog"
  | "presentation"
  | "image"
  | "email"
  | "knowledge";

export type ApiResponse<T> = {
  data: T;
  requestId?: string;
};

export { initMonitoring } from "./telemetry";
