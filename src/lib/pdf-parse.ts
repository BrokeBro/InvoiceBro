import "server-only";

// Import the inner module directly — the pdf-parse entry point tries to read
// a test PDF at import time (`!module.parent` is true inside bundlers).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse") as (
  buf: Buffer,
) => Promise<{ text: string }>;

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}
