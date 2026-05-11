import {
  generateBlog,
  generateChatResponse,
  generateEmailDraft,
  generateImageStudioBrief,
  generateKnowledgeSummary,
  generatePresentation,
  generateProposal
} from "@markitome/ai";
import type {
  BlogInput,
  ChatInput,
  EmailInput,
  ImageStudioInput,
  KnowledgeInput,
  PresentationInput,
  ProposalInput,
  WorkflowName
} from "@markitome/shared";

function workflowResult<TInput, TOutput>(type: WorkflowName, input: TInput, output: TOutput) {
  return { type, input, output };
}

export async function runProposalWorkflow(input: ProposalInput) {
  const output = await generateProposal(input);
  return workflowResult("proposal", input, output);
}

export async function runChatWorkflow(input: ChatInput) {
  const output = await generateChatResponse(input);
  return workflowResult("chat", input, output);
}

export async function runBlogWorkflow(input: BlogInput) {
  const output = await generateBlog(input);
  return workflowResult("blog", input, output);
}

export async function runPresentationWorkflow(input: PresentationInput) {
  const output = await generatePresentation(input);
  return workflowResult("presentation", input, output);
}

export async function runImageWorkflow(input: ImageStudioInput) {
  const output = await generateImageStudioBrief(input);
  return workflowResult("image", input, output);
}

export async function runEmailWorkflow(input: EmailInput) {
  const output = await generateEmailDraft(input);
  return workflowResult("email", input, output);
}

export async function runKnowledgeWorkflow(input: KnowledgeInput) {
  const output = await generateKnowledgeSummary(input);
  return workflowResult("knowledge", input, output);
}
