import type {
  BlogInput,
  ChatInput,
  EmailInput,
  ImageStudioInput,
  KnowledgeInput,
  PresentationInput,
  ProposalInput
} from "@markitome/shared";
import {
  buildProposalPricing,
  generateProposalFileName,
  proposalAcceptanceText,
  proposalContactInfo,
  proposalGstNote,
  proposalOnActualsNote,
  proposalTermsAndConditions,
  servicePricingIndia
} from "@markitome/shared";

export function proposalPrompt(input: ProposalInput) {
  const pricing = buildProposalPricing(input.requiredServices, input.discountPercent);
  const fileName = generateProposalFileName(input);

  return [
    "You are Markitome AI, an internal marketing strategy assistant.",
    "Create a professional client proposal using Markitome's proposal template logic.",
    "The termsAndConditions must be copied exactly from the Markitome proposal template provided below. Do not rewrite, reorder, summarize, or add to them.",
    "The pricingTable and pricingSummary must use the provided India pricing and discount calculation. Do not invent pricing.",
    "Return only one JSON object. Use these exact camelCase keys and value types:",
    JSON.stringify(
      {
        proposalNumber: fileName,
        fileName,
        clientName: input.clientName,
        clientUrl: input.clientWebsite,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        clientAddress: input.clientAddress,
        proposalTitle: "string",
        executiveSummary: "string",
        clientUnderstanding: "string",
        scopeOfServices: ["string"],
        deliverables: ["string"],
        timeline: "string",
        commercialStructure: "string",
        pricingTable: pricing.pricingTable,
        pricingSummary: pricing.pricingSummary,
        taxAndActualsNotes: [proposalGstNote, proposalOnActualsNote],
        termsAndConditions: proposalTermsAndConditions,
        acceptance: proposalAcceptanceText,
        contactInformation: proposalContactInfo,
        nextSteps: ["string"]
      },
      null,
      2
    ),
    `Proposal number / file name: ${fileName}`,
    `Client name: ${input.clientName}`,
    `Client website: ${input.clientWebsite}`,
    `Client email: ${input.clientEmail}`,
    `Client phone: ${input.clientPhone}`,
    `Client address: ${input.clientAddress}`,
    `Industry: ${input.industry}`,
    `Required services: ${input.requiredServices}`,
    `Budget range: ${input.budgetRange}`,
    `Timeline: ${input.timeline}`,
    `Objective: ${input.proposalObjective}`,
    `Notes: ${input.notes}`,
    `Discount percent: ${pricing.pricingSummary.discountPercent}`,
    `India pricing catalog: ${JSON.stringify(servicePricingIndia)}`,
    `Matched pricing table: ${JSON.stringify(pricing.pricingTable)}`,
    `Consolidated pricing after discount: ${JSON.stringify(pricing.pricingSummary)}`,
    `Exact terms and conditions: ${JSON.stringify(proposalTermsAndConditions)}`,
    `Acceptance text: ${JSON.stringify(proposalAcceptanceText)}`,
    `Contact information: ${JSON.stringify(proposalContactInfo)}`,
    `Use knowledge base: ${Boolean(input.useKnowledgeBase)}`,
    "Do not wrap the response in markdown. Do not add keys outside the schema."
  ].join("\n");
}

export function chatPrompt(input: ChatInput) {
  return [
    "You are Markitome AI, an internal assistant for marketing operations.",
    "Answer clearly, with practical next steps and references when context is provided.",
    `Message: ${input.message}`,
    `Context: ${input.context}`,
    `Knowledge source: ${input.knowledgeSource}`,
    "Return only JSON with exact keys: response (string), suggestedActions (string array), sourceReferences (string array)."
  ].join("\n");
}

export function blogPrompt(input: BlogInput) {
  return [
    "Create an SEO-ready blog draft for a client website in structured JSON.",
    `Client: ${input.clientName}`,
    `Website: ${input.website}`,
    `Topic: ${input.topic}`,
    `Target keyword: ${input.targetKeyword}`,
    `Tone: ${input.tone}`,
    `Word count: ${input.wordCount}`,
    `Audience: ${input.audience}`,
    `Use knowledge base: ${Boolean(input.useKnowledgeBase)}`,
    "Return only JSON with exact keys: seoTitle, metaTitle, metaDescription, slug, blogOutline, fullArticle, fullBlogDraft, faqs, internalLinkingSuggestions, schemaFriendlyStructure."
  ].join("\n");
}

export function presentationPrompt(input: PresentationInput) {
  return [
    "Create a presentation draft in structured JSON.",
    `Client: ${input.clientName}`,
    `Topic: ${input.topic}`,
    `Objective: ${input.objective}`,
    `Audience: ${input.audience}`,
    `Number of slides: ${input.numberOfSlides}`,
    `Tone: ${input.tone}`,
    `Use knowledge base: ${Boolean(input.useKnowledgeBase)}`,
    "Return only JSON with exact keys: slideTitles, slideWiseContent, speakerNotes, suggestedVisuals, ctaSlide, googleSlidesDraftPlaceholder."
  ].join("\n");
}

export function imageStudioPrompt(input: ImageStudioInput) {
  return [
    "Create a production-oriented image generation brief in structured JSON.",
    `Platform: ${input.platform}`,
    `Format: ${input.format}`,
    `Brand colors: ${input.brandColors}`,
    `Campaign objective: ${input.campaignObjective}`,
    `Image description: ${input.imageDescription}`,
    `Text overlay: ${input.textOverlay}`,
    `Style direction: ${input.styleDirection}`,
    `Client name: ${input.clientName}`,
    "Return only JSON with exact keys: generatedImagePlaceholder, imageUrl, promptUsed, captionOptions, designerNotes."
  ].join("\n");
}

export function emailPrompt(input: EmailInput) {
  return [
    "Draft an appropriate business email response in structured JSON.",
    `Recipient context: ${input.recipientContext}`,
    `Purpose: ${input.purpose}`,
    `Tone: ${input.tone}`,
    `Key points: ${input.keyPoints}`,
    `Desired CTA: ${input.desiredCta}`,
    "Return only JSON with exact keys: emailSubject, emailBody, shortFollowUpVersion, whatsappVersion."
  ].join("\n");
}

export function knowledgePrompt(input: KnowledgeInput) {
  return [
    "Prepare a knowledge base ingestion summary in structured JSON.",
    `Title: ${input.title}`,
    `Source: ${input.source}`,
    `Tags: ${input.tags}`,
    `Content: ${input.content}`,
    "Return only JSON with exact keys: indexedDocument, vectorIds, searchPreview, auditTrail."
  ].join("\n");
}
