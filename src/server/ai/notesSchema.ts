import { z } from "zod";

export const aiNotesSchema = z.object({
  summary: z.string(),
  suggested_action_items: z.array(
    z.object({
      task: z.string(),
      assignee: z.string().nullable(),
      due_date: z.string().nullable(),
      priority: z.enum(["low", "medium", "high"]),
      source_quote: z.string().nullable()
    })
  ),
  decisions: z.array(
    z.object({
      decision: z.string(),
      owner: z.string().nullable(),
      source_quote: z.string().nullable()
    })
  ),
  topic_overview: z.array(
    z.object({
      topic: z.string(),
      summary: z.string(),
      key_points: z.array(z.string()),
      open_questions: z.array(z.string())
    })
  ),
  risks_or_blockers: z.array(z.string()),
  follow_up_email_draft: z.string()
});

export type AiNotesJson = z.infer<typeof aiNotesSchema>;

export function renderNotesMarkdown(notes: AiNotesJson): string {
  const actionItems = notes.suggested_action_items
    .map((item) => `- [${item.priority}] ${item.task}${item.assignee ? ` (${item.assignee})` : ""}${item.due_date ? ` due ${item.due_date}` : ""}`)
    .join("\n");
  const decisions = notes.decisions.map((item) => `- ${item.decision}${item.owner ? ` (${item.owner})` : ""}`).join("\n");
  const topics = notes.topic_overview
    .map(
      (topic) =>
        `### ${topic.topic}\n${topic.summary}\n\nKey points:\n${topic.key_points.map((point) => `- ${point}`).join("\n") || "- None"}\n\nOpen questions:\n${topic.open_questions.map((question) => `- ${question}`).join("\n") || "- None"}`
    )
    .join("\n\n");

  return `# AI Meeting Notes

## Summary
${notes.summary}

## Suggested Action Items
${actionItems || "- None"}

## Decisions
${decisions || "- None"}

## Topic Overview
${topics || "No topics extracted."}

## Risks or Blockers
${notes.risks_or_blockers.map((risk) => `- ${risk}`).join("\n") || "- None"}

## Follow-up Email Draft
${notes.follow_up_email_draft}
`;
}
