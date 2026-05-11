export const MARKITOME_EMAIL_DOMAIN = "markitome.com";

export type AppRole = "ADMIN" | "MANAGER" | "TEAM_MEMBER" | "INTERN";

export type ProposalInput = {
  clientName: string;
  clientWebsite: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  industry: string;
  requiredServices: string;
  budgetRange: string;
  timeline: string;
  proposalObjective: string;
  notes: string;
  discountPercent: string;
  departmentCode: string;
  clientCode: string;
  deliveryDate: string;
  iteration: string;
  useKnowledgeBase?: boolean;
};

export type ProposalOutput = {
  proposalNumber: string;
  fileName: string;
  clientName: string;
  clientUrl: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  proposalTitle: string;
  executiveSummary: string;
  clientUnderstanding: string;
  scopeOfServices: string[];
  deliverables: string[];
  timeline: string;
  commercialStructure: string;
  pricingTable: import("./proposal-rules").ProposalPricingRow[];
  pricingSummary: import("./proposal-rules").ProposalPricingSummary;
  taxAndActualsNotes: string[];
  termsAndConditions: string[];
  acceptance: string[];
  contactInformation: typeof import("./proposal-rules").proposalContactInfo;
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
  audience: string;
  useKnowledgeBase?: boolean;
};

export type BlogOutput = {
  seoTitle: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  blogOutline: string[];
  fullArticle: string;
  fullBlogDraft: string;
  faqs: Array<{ question: string; answer: string }>;
  internalLinkingSuggestions: string[];
  schemaFriendlyStructure: string[];
};

export type PresentationInput = {
  clientName: string;
  topic: string;
  objective: string;
  audience: string;
  numberOfSlides: string;
  tone: string;
  useKnowledgeBase?: boolean;
};

export type PresentationOutput = {
  slideTitles: string[];
  slideWiseContent: Array<{ title: string; content: string[] }>;
  speakerNotes: string[];
  suggestedVisuals: string[];
  ctaSlide: string;
  googleSlidesDraftPlaceholder: string;
};

export type ImageStudioInput = {
  platform: string;
  format: string;
  brandColors: string;
  campaignObjective: string;
  imageDescription: string;
  textOverlay: string;
  styleDirection: string;
  clientName: string;
};

export type ImageStudioOutput = {
  generatedImagePlaceholder: string;
  imageUrl?: string | null;
  promptUsed: string;
  captionOptions: string[];
  designerNotes: string[];
};

export type EmailInput = {
  recipientContext: string;
  purpose: string;
  tone: string;
  keyPoints: string;
  desiredCta: string;
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
export {
  buildProposalPricing,
  generateProposalFileName,
  proposalAcceptanceText,
  proposalContactInfo,
  proposalGstNote,
  proposalOnActualsNote,
  proposalTermsAndConditions,
  servicePricingIndia
} from "./proposal-rules";
export type { ProposalPricingRow, ProposalPricingSummary, ServicePricing } from "./proposal-rules";
