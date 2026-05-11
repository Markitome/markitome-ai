import { PageHeader } from "../../../components/page-header";
import { WorkflowForm } from "../../../components/workflow-form";

export default function EmailAssistantPage() {
  return (
    <>
      <PageHeader title="Email Assistant" description="Draft appropriate email and WhatsApp responses while keeping Gmail actions server-side." />
      <WorkflowForm
        workflow="email"
        initialValues={{ recipientContext: "", purpose: "", tone: "Professional", keyPoints: "" }}
        fields={[
          { name: "recipientContext", label: "Recipient context", multiline: true },
          { name: "purpose", label: "Purpose" },
          { name: "tone", label: "Tone" },
          { name: "keyPoints", label: "Key points", multiline: true }
        ]}
      />
    </>
  );
}
