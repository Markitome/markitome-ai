export async function uploadToR2(key: string, body: Blob | Uint8Array | string) {
  // TODO: Configure Cloudflare R2 client with server-side environment variables only.
  return {
    key,
    size: typeof body === "string" ? body.length : undefined,
    TODO: "Configure Cloudflare R2 client with server-side environment variables only."
  };
}

export async function downloadFromR2(key: string) {
  // TODO: Configure Cloudflare R2 client with server-side environment variables only.
  return {
    key,
    body: null,
    TODO: "Configure Cloudflare R2 client with server-side environment variables only."
  };
}
