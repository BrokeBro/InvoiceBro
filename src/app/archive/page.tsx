import { AppShell } from "@/components/app-shell";
import { ArchiveManager } from "@/components/archive-manager";
import { requireCurrentOrg } from "@/lib/auth";
import { getSignedUrl, listArchivedInvoices } from "@/lib/data";

export const metadata = { title: "Archive · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const { org, user } = await requireCurrentOrg();
  const archived = await listArchivedInvoices(org.id);

  const withUrls = await Promise.all(
    archived.map(async (doc) => ({
      ...doc,
      url: await getSignedUrl(doc.storagePath),
    })),
  );

  return (
    <AppShell org={org} user={user} current="/archive">
      <ArchiveManager invoices={withUrls} />
    </AppShell>
  );
}
