import { PageHeader } from "../../../components/page-header";
import { AdminPanel } from "../../../components/admin-panel";

export default function AdminPage() {
  return (
    <>
      <PageHeader
        title="Admin Panel"
        description="RBAC, allowlists, usage limits, generated assets, and audit logs will be managed here."
      />
      <AdminPanel />
    </>
  );
}
