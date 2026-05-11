import { PageHeader } from "../../../components/page-header";
import { WorkflowForm } from "../../../components/workflow-form";

export default function BlogWriterPage() {
  return (
    <>
      <PageHeader title="Blog Writer" description="Create SEO-friendly drafts for client websites through the backend AI orchestrator." />
      <WorkflowForm
        workflow="blog"
        initialValues={{ clientName: "", website: "", topic: "", targetKeyword: "", tone: "Professional", wordCount: "900" }}
        fields={[
          { name: "clientName", label: "Client name" },
          { name: "website", label: "Website" },
          { name: "topic", label: "Topic" },
          { name: "targetKeyword", label: "Target keyword" },
          { name: "tone", label: "Tone" },
          { name: "wordCount", label: "Word count" }
        ]}
      />
    </>
  );
}
