export type ImportedInvoiceData = {
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  clientName: string | null;
  clientAddress: string | null;
  clientEmail: string | null;
  lineItems: {
    description: string;
    quantity: number;
    unitPriceCents: number;
    taxRatePercent: number;
  }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes: string;
};

function parseDateDMY(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return null;
  return `${year}-${month}-${day}`;
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[£$€,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function detectCurrency(text: string): string {
  if (text.includes("£") || /GBP/i.test(text)) return "GBP";
  if (text.includes("€") || /EUR/i.test(text)) return "EUR";
  if (text.includes("$") || /USD/i.test(text)) return "USD";
  return "GBP";
}

export function parseInvoiceText(text: string): ImportedInvoiceData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let invoiceNumber: string | null = null;
  let issueDate: string | null = null;
  let dueDate: string | null = null;
  let clientName: string | null = null;
  let clientAddress: string | null = null;
  let clientEmail: string | null = null;
  let totalCents = 0;
  const currency = detectCurrency(text);

  // Extract invoice number — handles "Invoice No.:007" and "Invoice No.: 007"
  for (const line of lines) {
    const numMatch = line.match(/Invoice\s*(?:No\.?|Number|#)\s*:?\s*(\S+)/i);
    if (numMatch) {
      invoiceNumber = numMatch[1];
      break;
    }
  }

  // Extract dates — handles "Issue date:15/08/2026" (no space after colon)
  for (const line of lines) {
    const issueDateMatch = line.match(/Issue\s*date\s*:?\s*(.+)/i);
    if (issueDateMatch) {
      issueDate = parseDateDMY(issueDateMatch[1]);
    }
    const dueDateMatch = line.match(/Due\s*date\s*:?\s*(.+)/i);
    if (dueDateMatch) {
      dueDate = parseDateDMY(dueDateMatch[1]);
    }
  }

  // Extract client from "BILL TO" block
  const fullText = lines.join("\n");
  const billToMatch = fullText.match(
    /BILL\s*TO\s*\n([\s\S]*?)(?=\n(?:Invoice|DESCRIPTION|TOTAL|Payment|$))/i,
  );
  if (billToMatch) {
    const billLines = billToMatch[1]
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (billLines.length > 0) {
      clientName = billLines[0];
      const addressParts: string[] = [];
      for (let i = 1; i < billLines.length; i++) {
        const line = billLines[i];
        if (line.includes("@")) {
          clientEmail = line;
        } else {
          addressParts.push(line);
        }
      }
      if (addressParts.length > 0) {
        clientAddress = addressParts.join(", ");
      }
    }
  }

  // Extract line items
  // Format A: concatenated columns like "3 hour20.000.0060.00"
  // with description + date on the 1-2 lines above
  const lineItems: ImportedInvoiceData["lineItems"] = [];
  const concatPattern =
    /^(\d+)\s*(?:hour|hrs?|unit|each|day|days?)\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const concatMatch = line.match(concatPattern);
    if (concatMatch) {
      const quantity = parseInt(concatMatch[1], 10) || 1;
      const unitPrice = parseMoney(concatMatch[2]);

      // Collect description from preceding lines (description + date)
      const descParts: string[] = [];
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j];
        if (
          concatPattern.test(prev) ||
          /DESCRIPTION|QUANTITY|AMOUNT/i.test(prev) ||
          /TOTAL/i.test(prev) ||
          /Invoice\s*No/i.test(prev)
        ) break;
        descParts.unshift(prev);
        if (descParts.length >= 2) break;
      }
      const description = descParts.join(" — ") || "Item";

      lineItems.push({
        description,
        quantity,
        unitPriceCents: unitPrice,
        taxRatePercent: 0,
      });
      continue;
    }

    // Format B: spaced columns like "3bd  3 hour  20.00  0.00  60.00"
    const spacedMatch = line.match(
      /^(.+?)\s+(\d+)\s+(?:hour|hrs?|unit|each|day|days?)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)$/i,
    );
    if (spacedMatch) {
      lineItems.push({
        description: spacedMatch[1].trim(),
        quantity: parseInt(spacedMatch[2], 10) || 1,
        unitPriceCents: parseMoney(spacedMatch[3]),
        taxRatePercent: 0,
      });
    }
  }

  // Extract total
  for (const line of lines) {
    const totalMatch = line.match(
      /TOTAL\s*(?:DUE)?\s*\(?(?:GBP|USD|EUR)?\)?\s*:?\s*[£$€]?\s*([\d,.]+)/i,
    );
    if (totalMatch) {
      totalCents = parseMoney(totalMatch[1]);
    }
  }

  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );
  if (totalCents === 0 && subtotalCents > 0) {
    totalCents = subtotalCents;
  }

  const taxCents = totalCents - subtotalCents;

  return {
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    clientName,
    clientAddress,
    clientEmail,
    lineItems,
    subtotalCents,
    taxCents: taxCents > 0 ? taxCents : 0,
    totalCents,
    notes: "",
  };
}
