import { PageHeader } from "../../../components/page-header";
import { WorkflowForm } from "../../../components/workflow-form";

export default function ChatPage() {
  return (
    <>
      <PageHeader title="Chat" description="A secured assistant surface for day-to-day internal tasks, research, and client-work support." />
      <WorkflowForm
        workflow="chat"
        initialValues={{ message: "", context: "", knowledgeSource: "" }}
        fields={[
          { name: "message", label: "Message", multiline: true },
          { name: "context", label: "Context", multiline: true },
          { name: "knowledgeSource", label: "Knowledge source" }
        ]}
      />
    </>
  );
}
