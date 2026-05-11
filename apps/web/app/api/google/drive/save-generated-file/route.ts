import { proxyApiRequest } from "../../../../../lib/api-proxy";

export async function POST(request: Request) {
  return proxyApiRequest("/v1/google/drive/save-generated-file", await request.json());
}
