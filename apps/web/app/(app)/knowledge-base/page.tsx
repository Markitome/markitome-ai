import { PageHeader } from "../../../components/page-header";
import { WorkflowForm } from "../../../components/workflow-form";

export default function KnowledgeBasePage() {
  return (
    <>
      <PageHeader title="Knowledge Base" description="Prepare documents for future R2 storage and Vectorize retrieval." />
      <WorkflowForm
        workflow="knowledge"
        initialValues={{ title: "", source: "", content: "", tags: "" }}
        fields={[
          { name: "title", label: "Document title" },
          { name: "source", label: "Source" },
          { name: "content", label: "Document content", multiline: true },
          { name: "tags", label: "Tags" }
        ]}
      />
    </>
  );
}
