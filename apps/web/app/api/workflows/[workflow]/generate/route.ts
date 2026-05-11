import { proxyApiRequest } from "../../../../../lib/api-proxy";

const allowedWorkflows = new Set(["chat", "blog", "presentation", "image", "email", "knowledge"]);

export async function POST(request: Request, { params }: { params: { workflow: string } }) {
  if (!allowedWorkflows.has(params.workflow)) {
    return Response.json({ error: "Unknown workflow" }, { status: 404 });
  }

  return proxyApiRequest(`/v1/workflows/${params.workflow}/generate`, await request.json());
}
