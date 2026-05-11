import { generateProposal } from "@markitome/ai";
import type { ProposalInput } from "@markitome/shared";

export const aiOrchestrator = {
  async generateProposal(input: ProposalInput) {
    // TODO: Add request classification, policy checks, usage limits, tracing, and model fallback routing.
    return generateProposal(input);
  }
};
