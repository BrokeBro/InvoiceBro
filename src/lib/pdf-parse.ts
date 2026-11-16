import "server-only";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;

  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    let lastY: number | null = null;
    let pageText = "";
    for (const item of content.items) {
      const ti = item as TextItem;
      if (!ti.str) continue;
      const y = ti.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        pageText += "\n";
      }
      pageText += ti.str;
      lastY = y;
    }

    text += (text ? "\n\n" : "") + pageText;
  }

  await loadingTask.destroy();
  return text;
}
