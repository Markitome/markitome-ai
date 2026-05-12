import { getToken } from "next-auth/jwt";

const LETTERHEAD_DOC_ID = "150oNSjm1q_fpdWnM7c5906w8zCBdN2a04DSRstdcOpQ";
const PROPOSAL_FOLDER_ID = "0B66AurKcrXWUMGNaLXk3WXNmSEk";

type AddToDrivePayload = {
  output?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const token = await getToken({ req: request as never, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = token.googleAccessToken;
  if (!accessToken || typeof accessToken !== "string") {
    return Response.json(
      {
        error: "Google Drive access is not connected. Please sign out and sign in again to grant Drive and Docs permissions."
      },
      { status: 403 }
    );
  }

  const payload = (await request.json()) as AddToDrivePayload;
  if (!payload.output) {
    return Response.json({ error: "Proposal output is required." }, { status: 400 });
  }

  try {
    const proposalNumber = text(payload.output.proposalNumber, "MAPRO001");
    const copied = await copyLetterheadDoc(accessToken, proposalNumber);
    await replaceFooterText(accessToken, copied.id, proposalNumber);
    await appendProposalContent(accessToken, copied.id, payload.output);

    return Response.json({
      data: {
        ok: true,
        id: copied.id,
        name: copied.name,
        url: `https://docs.google.com/document/d/${copied.id}/edit`
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to create Google Drive proposal."
      },
      { status: 500 }
    );
  }
}

async function copyLetterheadDoc(accessToken: string, proposalNumber: string) {
  const response = await googleFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${LETTERHEAD_DOC_ID}/copy?supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: "POST",
      body: JSON.stringify({
        name: proposalNumber,
        parents: [PROPOSAL_FOLDER_ID]
      })
    }
  );

  return (await response.json()) as { id: string; name: string; webViewLink?: string };
}

async function replaceFooterText(accessToken: string, documentId: string, proposalNumber: string) {
  await googleFetch(accessToken, `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          replaceAllText: {
            containsText: {
              text: "File Name",
              matchCase: true
            },
            replaceText: proposalNumber
          }
        }
      ]
    })
  });
}

async function appendProposalContent(accessToken: string, documentId: string, output: Record<string, unknown>) {
  const document = await googleFetch(accessToken, `https://docs.googleapis.com/v1/documents/${documentId}`);
  const doc = (await document.json()) as { body?: { content?: Array<{ endIndex?: number }> } };
  const endIndex = Math.max(1, (doc.body?.content?.at(-1)?.endIndex ?? 2) - 1);
  const content = proposalToGoogleDocText(output);

  await googleFetch(accessToken, `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: endIndex },
            text: content
          }
        }
      ]
    })
  });
}

async function googleFetch(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google API request failed with status ${response.status}: ${message.slice(0, 300)}`);
  }

  return response;
}

function proposalToGoogleDocText(output: Record<string, unknown>) {
  const pricingSummary = record(output.pricingSummary);
  const contact = record(output.contactInformation);

  return [
    "",
    `Proposal Number: ${text(output.proposalNumber, "")}`,
    `Name: ${text(output.clientName, "")}`,
    `Date: ${new Date().toLocaleDateString("en-IN")}`,
    `URL: ${text(output.clientUrl, "")}`,
    `Email: ${text(output.clientEmail, "")}`,
    `Ph No: ${text(output.clientPhone, "")}`,
    `Address: ${text(output.clientAddress, "")}`,
    "",
    text(output.proposalTitle, "Proposal"),
    "*In the interest of going paperless, this is an online proposal. Please reply to the email to acknowledge.",
    "",
    "1. Executive Summary",
    text(output.executiveSummary, ""),
    "",
    "2. Client Understanding",
    text(output.clientUnderstanding, ""),
    "",
    "3. Scope of Services",
    formatList(output.scopeOfServices),
    "",
    "4. Deliverables",
    formatList(output.deliverables),
    "",
    "5. Timeline",
    text(output.timeline, ""),
    "",
    "6. Budget and Fees",
    formatPricingTable(output.pricingTable),
    "",
    `Subtotal: ${text(pricingSummary.subtotal, "")}`,
    `Discount: ${text(pricingSummary.discountPercent, "0")}% (${text(pricingSummary.discountAmount, "")})`,
    `Consolidated Total After Discount: ${text(pricingSummary.totalAfterDiscount, "")}`,
    "",
    "Notes",
    formatList(output.taxAndActualsNotes),
    "",
    "7. Terms and Conditions",
    formatList(output.termsAndConditions),
    "",
    "8. Acceptance",
    formatList(output.acceptance),
    "",
    "9. Contact Information",
    text(contact.company, "Markitome"),
    text(contact.address, ""),
    `Email: ${text(contact.email, "")}`,
    `Phone: ${text(contact.phone, "")}`,
    "",
    "10. Next Steps",
    formatList(output.nextSteps),
    ""
  ].join("\n");
}

function formatPricingTable(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      const row = record(item);
      return [
        `Service: ${text(row.service, "")}`,
        `India Low: ${text(row.indiaLow, "")}`,
        `India High: ${text(row.indiaHigh, "")}`,
        `Selected: ${text(row.selectedAmount, "")}`,
        `Payment Terms: ${text(row.paymentTerms, "")}`
      ].join("\n");
    })
    .join("\n\n");
}

function formatList(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => `• ${text(item, "")}`).join("\n");
}

function record(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}
