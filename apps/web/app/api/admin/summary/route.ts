import { proxyApiRequest } from "../../../../lib/api-proxy";

export async function GET() {
  return proxyApiRequest("/v1/admin/summary");
}
