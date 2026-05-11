import { PageHeader } from "../../../components/page-header";
import { WorkflowForm } from "../../../components/workflow-form";

export default function ImageStudioPage() {
  return (
    <>
      <PageHeader title="Image Studio" description="Generate creative image prompts and future assets for posters, graphics, and social media posts." />
      <WorkflowForm
        workflow="image"
        initialValues={{ platform: "", format: "", brandColors: "", campaignObjective: "", imageDescription: "", textOverlay: "" }}
        fields={[
          { name: "platform", label: "Platform" },
          { name: "format", label: "Format" },
          { name: "brandColors", label: "Brand colors" },
          { name: "campaignObjective", label: "Campaign objective", multiline: true },
          { name: "imageDescription", label: "Image description", multiline: true },
          { name: "textOverlay", label: "Text overlay" }
        ]}
      />
    </>
  );
}
