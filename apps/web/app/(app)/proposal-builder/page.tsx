import { ProposalBuilder } from "../../../components/proposal-builder";
import { PageHeader } from "../../../components/page-header";

export default function ProposalBuilderPage() {
  return (
    <>
      <PageHeader
        title="Proposal Builder"
        description="Generate structured client proposals and prepare them for Google Drive export."
      />
      <ProposalBuilder />
    </>
  );
}
