export type ServicePricing = {
  service: string;
  features?: string;
  indiaLow: string;
  indiaHigh?: string;
  paymentTerms: string;
};

export type ProposalPricingRow = ServicePricing & {
  selectedAmount: string;
  notes: string;
};

export type ProposalPricingSummary = {
  subtotal: string;
  discountPercent: number;
  discountAmount: string;
  totalAfterDiscount: string;
  gstNote: string;
  onActualsNote: string;
};

export const proposalTermsAndConditions = [
  "Markitome is a Plug & Play or a Pay & Use agency. All projects will commence on the realization of clearance of the invoice.",
  "In the case of a retainer, invoices will be generated on the 2nd of every month. Dues shall be cleared on or before the 7th of the same month. Delay of payment would entail a monthly fine of 4.5%.",
  "All Payments should be made in favour of M/s MARKITOME payable at Hyderabad.",
  "Confidentiality: Both parties agree to maintain confidentiality regarding all information exchanged.",
  "Intellectual Property: Upon full payment, all deliverables will be owned by the Client.",
  "Termination: Either party may terminate this agreement with 7 days' written notice.",
  "Please feel free to go through Markitome’s Service Terms & Policies"
];

export const proposalAcceptanceText = [
  "This is a digital proposal and does not require a physical signature.",
  "Kindly confirm your approval by replying to the email shared by Team Markitome. Upon confirmation, the terms outlined in this proposal will be considered accepted, and the project will be initiated."
];

export const proposalContactInfo = {
  company: "Markitome",
  address: "167 Vayupuri, 2nd Cross Roads, Secunderabad, Telangana - 500094, India",
  email: "info@markitome.com",
  phone: "+91 63019 36852"
};

export const proposalGstNote =
  "Prices DO NOT include GST. 18% GST will be added over the listed prices during billing. All retainer models require ₹15,000 setup fee.";

export const proposalOnActualsNote =
  "Third-party costs and variable external expenses are billed on actuals wherever applicable, including ad spends, influencer fees, media buying or publishing costs, printing, production, photography, videography, domains, hosting, software subscriptions, paid plugins, travel, logistics, and any client-approved out-of-scope services.";

export const servicePricingIndia: ServicePricing[] = [
  {
    service: "Personal Website (WordPress + Elementor Pro)",
    features: "AI chatbot integration or LLM-based SEO tools; performance dashboards; subscription content services; website maintenance/support retainer may increase costs.",
    indiaLow: "₹20,000",
    paymentTerms: "One time payment for the development but Elementor will be charged from Year 2"
  },
  {
    service: "Corporate Website (WordPress + Elementor Pro)",
    indiaLow: "₹30,000",
    paymentTerms: "One time payment for the development but Elementor will be charged from Year 2"
  },
  {
    service: "E-commerce Website (WordPress + WooCommerce + Elementor Pro)",
    indiaLow: "₹70,000",
    paymentTerms: "One time payment for the development but Elementor will be charged from Year 2"
  },
  {
    service: "Basic Mobile App Development",
    features: "AI chatbot integration or LLM-based SEO tools; performance dashboards; subscription content services; monthly maintenance/support retainer may increase costs.",
    indiaLow: "₹35,000",
    paymentTerms: "May require monthly maintenance"
  },
  {
    service: "Native Mobile App Development",
    indiaLow: "₹75,000",
    paymentTerms: "May require monthly maintenance"
  },
  { service: "Search Engine Optimization (SEO)", indiaLow: "₹20,000", paymentTerms: "Monthly Retainer" },
  { service: "Social Media Marketing", indiaLow: "₹25,000", paymentTerms: "Monthly Retainer" },
  {
    service: "Influencer Marketing",
    features: "Nano, micro, macro, and mega influencer costs vary by follower tier and content type.",
    indiaLow: "₹10,000",
    paymentTerms: "Project Specific. Influencer costs are billed on actuals per post/content piece."
  },
  { service: "PPC/PPM Campaign Management (Meta/Google)", indiaLow: "₹20,000", paymentTerms: "Monthly Retainer / Project Specific" },
  { service: "Blogging - General", indiaLow: "₹10,000", paymentTerms: "3 Posts" },
  { service: "Blogging - Technical", indiaLow: "₹15,000", paymentTerms: "2 Posts" },
  { service: "LLM Optimization", indiaLow: "₹50,000", paymentTerms: "Monthly Retainer" },
  { service: "Email Marketing", indiaLow: "₹10,000", paymentTerms: "Per Campaign" },
  { service: "Graphic Design Services", indiaLow: "₹10,000", paymentTerms: "Project Specific" },
  { service: "Press Releases Service Charge", indiaLow: "₹10,000", paymentTerms: "Media Cost May Cost More" },
  { service: "Complete Media Pack Service Charge", indiaLow: "₹2,50,000", paymentTerms: "Media Cost May Cost More" },
  {
    service: "1 on 1 Consultation with Vivek Rangabhashyam (Used for Marketing Consultation and Brand Positioning)",
    indiaLow: "₹75,000 (Per Hour)",
    paymentTerms: "Minimum 3 hours commitment"
  }
];

export function buildProposalPricing(requiredServices: string, discountPercentValue: string | number | undefined) {
  const matches = matchServices(requiredServices);
  const discountPercent = clampDiscount(discountPercentValue);
  const subtotalNumber = matches.reduce((total, row) => total + parseRupees(row.selectedAmount), 0);
  const discountNumber = Math.round((subtotalNumber * discountPercent) / 100);
  const totalAfterDiscountNumber = Math.max(0, subtotalNumber - discountNumber);

  return {
    pricingTable: matches,
    pricingSummary: {
      subtotal: formatRupees(subtotalNumber),
      discountPercent,
      discountAmount: formatRupees(discountNumber),
      totalAfterDiscount: formatRupees(totalAfterDiscountNumber),
      gstNote: proposalGstNote,
      onActualsNote: proposalOnActualsNote
    }
  };
}

export function generateProposalFileName(input: {
  proposalNumber?: string;
  iteration?: string;
}) {
  const proposalNumber = sanitizeProposalNumber(input.proposalNumber, "MAPRO");
  const iteration = sanitizeNumber(input.iteration, "001", 3);
  return `${proposalNumber}${iteration}`;
}

function matchServices(requiredServices: string): ProposalPricingRow[] {
  const requested = requiredServices.toLowerCase();
  const matched = servicePricingIndia.filter((item) => serviceMatches(requested, item.service));
  const rows = matched.length > 0 ? matched : servicePricingIndia.filter((item) => requested.includes(firstWord(item.service)));

  return (rows.length > 0 ? rows : servicePricingIndia.slice(0, 4)).map((item) => ({
    ...item,
    selectedAmount: item.indiaLow,
    notes: item.paymentTerms
  }));
}

function serviceMatches(requested: string, service: string) {
  const serviceName = service.toLowerCase();
  const aliases = [
    serviceName,
    serviceName.replace("search engine optimization", "seo"),
    serviceName.replace("website", "web"),
    serviceName.replace("ppc/ppm campaign management (meta/google)", "meta/google ad campaigns"),
    serviceName.replace("ppc/ppm campaign management (meta/google)", "ads"),
    serviceName.replace("ppc/ppm campaign management (meta/google)", "ppc"),
    serviceName.replace("blogging - general", "blog"),
    serviceName.replace("blogging - technical", "technical blog")
  ];
  return aliases.some((alias) => requested.includes(alias) || alias.includes(requested));
}

function firstWord(value: string) {
  return value.toLowerCase().split(/\s+/)[0] ?? "";
}

function clampDiscount(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function parseRupees(value: string) {
  const numeric = value.replace(/[^\d]/g, "");
  return Number.parseInt(numeric || "0", 10);
}

function formatRupees(value: number) {
  return `₹${new Intl.NumberFormat("en-IN").format(value)}`;
}

function sanitizeProposalNumber(value: string | undefined, fallback: string) {
  const cleaned = String(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned || fallback;
}

function sanitizeNumber(value: string | undefined, fallback: string, length: number) {
  const cleaned = String(value || fallback).replace(/\D/g, "");
  return (cleaned || fallback).slice(-length).padStart(length, "0");
}
