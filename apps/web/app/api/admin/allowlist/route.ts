import { proxyApiRequest } from "../../../../lib/api-proxy";

export async function POST(request: Request) {
  return proxyApiRequest("/v1/admin/allowlist", await request.json());
}
