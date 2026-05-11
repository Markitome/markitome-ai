import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

type ProposalPdfPayload = {
  output?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as ProposalPdfPayload;
  if (!payload.output) {
    return Response.json({ error: "Proposal output is required" }, { status: 400 });
  }

  const pdf = buildProposalPdf(payload.output);
  const fileName = sanitizeFileName(text(payload.output.fileName, "Markitome-Proposal"));

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}

function buildProposalPdf(output: Record<string, unknown>) {
  const fileName = text(output.fileName, "File Name");
  const writer = new PdfWriter(fileName);

  writer.addPage((page) => {
    page.heading("Markitome Proposal");
    page.meta("Proposal Number", text(output.proposalNumber, ""));
    page.meta("File Name", text(output.fileName, ""));
    page.meta("Name", text(output.clientName, ""));
    page.meta("Date", new Date().toLocaleDateString("en-IN"));
    page.meta("URL", text(output.clientUrl, ""));
    page.meta("Email", text(output.clientEmail, ""));
    page.meta("Ph No", text(output.clientPhone, ""));
    page.meta("Address", text(output.clientAddress, ""));
    page.spacer();
    page.title(text(output.proposalTitle, "Proposal"));
    page.paragraph("*In the interest of going paperless, this is an online proposal. Please reply to the email to acknowledge.");
  });

  writer.addPage((page) => {
    page.section("1. Executive Summary");
    page.paragraph(text(output.executiveSummary, ""));
    page.section("2. Client Understanding");
    page.paragraph(text(output.clientUnderstanding, ""));
    page.section("3. Scope of Services");
    page.list(list(output.scopeOfServices));
    page.section("4. Deliverables");
    page.list(list(output.deliverables));
    page.section("5. Timeline");
    page.paragraph(text(output.timeline, ""));
  });

  writer.addPage((page) => {
    page.section("6. Budget and Fees");
    page.pricingTable(listRecords(output.pricingTable));
    const summary = record(output.pricingSummary);
    page.spacer();
    page.meta("Subtotal", text(summary.subtotal, ""));
    page.meta("Discount", `${text(summary.discountPercent, "0")}% (${text(summary.discountAmount, "")})`);
    page.meta("Consolidated Total After Discount", text(summary.totalAfterDiscount, ""));
    page.section("Notes");
    page.list(list(output.taxAndActualsNotes));
  });

  writer.addPage((page) => {
    page.section("7. Terms and Conditions");
    page.list(list(output.termsAndConditions));
    page.section("8. Acceptance");
    page.list(list(output.acceptance));
    page.section("9. Contact Information");
    const contact = record(output.contactInformation);
    page.paragraph(
      [
        text(contact.company, "Markitome"),
        text(contact.address, ""),
        `Email: ${text(contact.email, "")}`,
        `Phone: ${text(contact.phone, "")}`
      ].filter(Boolean).join("\n")
    );
    page.section("10. Next Steps");
    page.list(list(output.nextSteps));
  });

  return writer.finish();
}

class PdfWriter {
  private pages: string[] = [];

  constructor(private fileName: string) {}

  addPage(draw: (page: PdfPage) => void) {
    const page = new PdfPage(this.pages.length + 1, this.fileName);
    draw(page);
    this.pages.push(page.content());
  }

  finish() {
    const objects: string[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push(`<< /Type /Pages /Kids [${this.pages.map((_, index) => `${index + 3} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);

    const contentObjectStart = 3 + this.pages.length;
    this.pages.forEach((_, index) => {
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.92 842.88] /Resources << /Font << /F1 ${contentObjectStart + this.pages.length} 0 R /F2 ${contentObjectStart + this.pages.length + 1} 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`);
    });
    this.pages.forEach((content) => {
      const renderedContent = content.replaceAll("__TOTAL_PAGES__", String(this.pages.length));
      objects.push(`<< /Length ${byteLength(renderedContent)} >>\nstream\n${renderedContent}\nendstream`);
    });
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    return new Uint8Array([...pdf].map((char) => char.charCodeAt(0)));
  }
}

class PdfPage {
  private commands: string[] = [];
  private y = 726;

  constructor(private pageNumber: number, private fileName: string) {
    this.drawLetterhead();
  }

  content() {
    return this.commands.join("\n");
  }

  heading(value: string) {
    this.text(50, this.y, value, 24, true);
    this.y -= 34;
  }

  title(value: string) {
    this.text(50, this.y, value, 18, true);
    this.y -= 28;
  }

  section(value: string) {
    this.ensureSpace(32);
    this.text(50, this.y, value, 13, true);
    this.y -= 20;
  }

  meta(label: string, value: string) {
    this.ensureSpace(18);
    this.text(50, this.y, `${label}:`, 10, true);
    this.text(170, this.y, value, 10, false);
    this.y -= 16;
  }

  paragraph(value: string) {
    this.wrap(value, 92).forEach((line) => {
      this.ensureSpace(15);
      this.text(50, this.y, line, 10, false);
      this.y -= 14;
    });
    this.y -= 4;
  }

  list(items: string[]) {
    items.forEach((item) => {
      this.wrap(item, 86).forEach((line, index) => {
        this.ensureSpace(15);
        this.text(index === 0 ? 58 : 72, this.y, `${index === 0 ? "- " : ""}${line}`, 10, false);
        this.y -= 14;
      });
    });
    this.y -= 4;
  }

  pricingTable(rows: Record<string, unknown>[]) {
    this.text(50, this.y, "Service", 9, true);
    this.text(255, this.y, "Low", 9, true);
    this.text(325, this.y, "High", 9, true);
    this.text(405, this.y, "Selected", 9, true);
    this.text(480, this.y, "Terms", 9, true);
    this.y -= 15;

    rows.forEach((row) => {
      const serviceLines = this.wrap(text(row.service, ""), 34).slice(0, 3);
      const termsLines = this.wrap(text(row.paymentTerms, ""), 18).slice(0, 3);
      const height = Math.max(serviceLines.length, termsLines.length, 1) * 12 + 8;
      this.ensureSpace(height);
      serviceLines.forEach((line, index) => this.text(50, this.y - index * 12, line, 8, false));
      this.text(255, this.y, normalizeCurrency(text(row.indiaLow, "")), 8, false);
      this.text(325, this.y, normalizeCurrency(text(row.indiaHigh, "")), 8, false);
      this.text(405, this.y, normalizeCurrency(text(row.selectedAmount, "")), 8, false);
      termsLines.forEach((line, index) => this.text(480, this.y - index * 12, line, 8, false));
      this.y -= height;
    });
  }

  spacer() {
    this.y -= 10;
  }

  private ensureSpace(height: number) {
    if (this.y - height < 50) {
      this.y = 726;
    }
  }

  private text(x: number, y: number, value: string, size: number, bold: boolean) {
    this.commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  }

  private drawLetterhead() {
    this.commands.push("q 0.9608 0.9608 0.9608 rg 0 0 595.92 842.88 re f Q");
    this.commands.push("q 1 1 1 rg 45 72 506 688 re f Q");
    this.commands.push("q 0 0.5686 0.7804 RG 1.1 w 45 72 506 688 re S Q");
    this.commands.push("q 0.9098 0.9176 0.9294 rg 0 0 220 220 re f Q");
    this.commands.push("q 0.3137 0.3608 0.4353 rg 48 35 64 15 re f Q");
    this.text(48, 790, "Mark", 18, true);
    this.text(48, 770, "itome", 18, true);
    this.text(432, 790, "Mark", 20, true);
    this.text(432, 768, "itome", 20, true);
    this.text(50, 38, this.fileName, 9, false);
    this.text(498, 38, `${this.pageNumber} of __TOTAL_PAGES__`, 9, false);
  }

  private wrap(value: string, limit: number) {
    return normalizeText(value)
      .split("\n")
      .flatMap((paragraph) => {
        const words = paragraph.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = "";
        words.forEach((word) => {
          const next = current ? `${current} ${word}` : word;
          if (next.length > limit && current) {
            lines.push(current);
            current = word;
          } else {
            current = next;
          }
        });
        if (current) lines.push(current);
        return lines.length ? lines : [""];
      });
  }
}

function text(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function record(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item, "")).filter(Boolean) : [];
}

function listRecords(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "Markitome-Proposal";
}

function normalizeCurrency(value: string) {
  return normalizeText(value).replace(/₹/g, "Rs. ");
}

function normalizeText(value: string) {
  return value
    .replace(/₹/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function escapePdfText(value: string) {
  return normalizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}
