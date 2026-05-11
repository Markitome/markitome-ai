import { PageHeader } from "../../../components/page-header";
import { WorkflowForm } from "../../../components/workflow-form";

export default function PresentationBuilderPage() {
  return (
    <>
      <PageHeader title="Presentation Builder" description="Research and outline slide decks before creating Google Slides drafts." />
      <WorkflowForm
        workflow="presentation"
        initialValues={{ clientName: "", topic: "", objective: "", audience: "Stakeholders", numberOfSlides: "8", tone: "Professional", useKnowledgeBase: false }}
        fields={[
          { name: "clientName", label: "Client name" },
          { name: "topic", label: "Topic" },
          { name: "objective", label: "Objective", multiline: true },
          { name: "audience", label: "Audience" },
          { name: "numberOfSlides", label: "Number of slides" },
          { name: "tone", label: "Tone" },
          { name: "useKnowledgeBase", label: "Use Knowledge Base", checkbox: true }
        ]}
      />
    </>
  );
}
