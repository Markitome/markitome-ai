export function GET() {
  return Response.json({
    ok: true,
    service: "markitome-ai",
    timestamp: new Date().toISOString()
  });
}
