import { PageHeader } from "../../../components/page-header";
import { ChatWorkspace } from "../../../components/chat-workspace";

export default function ChatPage() {
  return (
    <>
      <PageHeader title="Chat" description="A secured assistant surface for day-to-day internal tasks, research, and client-work support." />
      <ChatWorkspace />
    </>
  );
}
