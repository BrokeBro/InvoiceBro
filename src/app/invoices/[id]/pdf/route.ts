import { requireCurrentOrg } from "@/lib/auth";
import { getInvoice, getLogoUrl } from "@/lib/data";
import { pdfFilename, renderInvoicePdf } from "@/lib/pdf/render";

// @react-pdf/renderer and firebase-admin both need Node APIs — never Edge.
export const runtime = "nodejs";
// Always render fresh: an invoice edited a moment ago must not serve a cached PDF.
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";

  // requireCurrentOrg resolves the caller's own org, and the invoice is then
  // looked up *within* it. An invoice ID belonging to another tenant simply
  // isn't found — there is no path here that reads across orgs.
  const { org } = await requireCurrentOrg();

  const invoice = await getInvoice(org.id, id);
  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const logoUrl = await getLogoUrl(org.logoPath);

  try {
    const pdf = await renderInvoicePdf({ invoice, organization: org, logoUrl });
    const filename = pdfFilename(invoice, org);

    // `inline` previews in a browser tab; `attachment` forces a save. The
    // HTML `download` attribute alone can't do this — it's ignored once the
    // response sets its own Content-Disposition — so the UI asks via ?download=1.
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("PDF render failed", error);
    return new Response("Could not generate the PDF", { status: 500 });
  }
}
