import { SignJWT } from "jose";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function proxyApiRequest(path: string, body?: unknown) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "Authentication secret is not configured" }, { status: 500 });
  }

  const apiToken = await new SignJWT({
    email: session.user.email,
    roles: session.user.roles
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  return Response.json(await response.json(), { status: response.status });
}
