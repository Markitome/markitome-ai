import { PageHeader } from "../../../components/page-header";
import Link from "next/link";

const modules = [
  ["Proposal Builder", "/proposal-builder"],
  ["Blog Writer", "/blog-writer"],
  ["Presentation Builder", "/presentation-builder"],
  ["Image Studio", "/image-studio"],
  ["Email Assistant", "/email-assistant"],
  ["Knowledge Base", "/knowledge-base"]
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A focused control room for client work, content generation, research, and internal support tasks."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(([module, href]) => (
          <Link key={module} href={href} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow">
            <h2 className="font-semibold text-ink">{module}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Workflow foundation is ready for secured AI orchestration and future Google Drive automation.
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
