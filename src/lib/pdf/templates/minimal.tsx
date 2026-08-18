import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/dates";
import { formatMoney, lineSubtotalCents } from "@/lib/money";
import { FONT, INK, PAGE, SIZE } from "@/lib/pdf/theme";
import type { PdfDocumentProps } from "@/lib/pdf/types";

// MINIMAL — typographic, almost no chrome. One accent hairline, wide margins,
// and a single bold number. The accent is used once, so it actually reads as an
// accent.

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: PAGE.padding + 24,
    paddingHorizontal: 56,
    fontFamily: FONT.body,
    fontSize: SIZE.body,
    color: INK.body,
    // No page-level lineHeight — see the note in theme.ts: it silently breaks
    // <Text render={…}>, which is how the page-number footer is drawn.
  },
  rule: { height: 2, marginBottom: 26 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 38,
  },
  logo: { width: 96, maxHeight: 40, objectFit: "contain", marginBottom: 6 },
  orgName: { fontFamily: FONT.bold, fontSize: SIZE.lead, color: INK.strong },
  orgLine: { fontSize: SIZE.small, color: INK.muted },
  title: {
    fontFamily: FONT.bold,
    fontSize: SIZE.heading,
    letterSpacing: 3,
    color: INK.strong,
    textAlign: "right",
  },
  number: { fontSize: SIZE.small, color: INK.muted, textAlign: "right", marginTop: 3 },

  meta: { flexDirection: "row", marginBottom: 34 },
  metaColumn: { width: "33%" },
  label: {
    fontFamily: FONT.bold,
    fontSize: SIZE.micro,
    letterSpacing: 1.2,
    color: INK.faint,
    marginBottom: 4,
  },
  strong: { fontFamily: FONT.bold, color: INK.strong },

  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: INK.faint,
    paddingBottom: 5,
  },
  row: { flexDirection: "row", paddingVertical: 8 },
  colDescription: { width: "50%", paddingRight: 10 },
  colQty: { width: "11%", textAlign: "right" },
  colRate: { width: "18%", textAlign: "right" },
  colAmount: { width: "21%", textAlign: "right" },
  headText: { fontFamily: FONT.bold, fontSize: SIZE.micro, letterSpacing: 1, color: INK.faint },
  taxNote: { fontSize: SIZE.micro, color: INK.faint },

  totals: { marginTop: 18, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "42%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: INK.faint,
  },
  grandLabel: {
    fontFamily: FONT.bold,
    fontSize: SIZE.micro,
    letterSpacing: 1.2,
    color: INK.faint,
  },
  grandValue: { fontFamily: FONT.bold, fontSize: SIZE.heading, color: INK.strong },

  notesBody: { fontSize: SIZE.small, color: INK.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: SIZE.micro,
    color: INK.faint,
  },
});

export function MinimalTemplate({
  invoice,
  organization,
  logoUrl,
  accentColor,
}: PdfDocumentProps) {
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const balanceDue = invoice.totalCents - invoice.amountPaidCents;

  // Mixed tax rates can't be summarised as one percentage, so only show a rate
  // when every line genuinely shares it.
  const rates = new Set(invoice.lineItems.map((item) => item.taxRatePercent));
  const singleRate = rates.size === 1 ? [...rates][0] : null;

  return (
    <Document
      title={`Invoice ${invoice.number ?? "draft"}`}
      author={organization.name}
      subject={`Invoice for ${invoice.client.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={[styles.rule, { backgroundColor: accentColor }]} />

        <View style={styles.header}>
          <View>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <Text style={styles.orgName}>{organization.name}</Text>
            {organization.address && organization.visibility?.showAddress !== false ? (
              <Text style={styles.orgLine}>{organization.address}</Text>
            ) : null}
            {organization.email ? (
              <Text style={styles.orgLine}>{organization.email}</Text>
            ) : null}
            {organization.vatNumber ? (
              <Text style={styles.orgLine}>VAT {organization.vatNumber}</Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.number}>{invoice.number ?? "DRAFT"}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={[styles.metaColumn, { width: "40%" }]}>
            <Text style={styles.label}>TO</Text>
            <Text style={styles.strong}>{invoice.client.name}</Text>
            {invoice.client.address ? <Text>{invoice.client.address}</Text> : null}
            {invoice.client.email ? <Text>{invoice.client.email}</Text> : null}
            {/* Only when they are actually VAT registered — an unregistered
                client has no number to show under their address. */}
            {invoice.client.vatRegistered && invoice.client.vatNumber ? (
              <Text>VAT {invoice.client.vatNumber}</Text>
            ) : null}
          </View>
          <View style={styles.metaColumn}>
            <Text style={styles.label}>ISSUED</Text>
            <Text>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={styles.metaColumn}>
            <Text style={styles.label}>DUE</Text>
            <Text style={styles.strong}>{formatDate(invoice.dueDate)}</Text>
          </View>
        </View>

        {/* Not `fixed`: react-pdf would repeat it on the totals/notes page too,
            printing a column header above no rows at all. */}
        <View style={styles.tableHead}>
          <Text style={[styles.colDescription, styles.headText]}>DESCRIPTION</Text>
          <Text style={[styles.colQty, styles.headText]}>QTY</Text>
          <Text style={[styles.colRate, styles.headText]}>RATE</Text>
          <Text style={[styles.colAmount, styles.headText]}>AMOUNT</Text>
        </View>

        {invoice.lineItems.map((item, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <View style={styles.colDescription}>
              <Text>{item.description}</Text>
              {singleRate === null && item.taxRatePercent > 0 ? (
                <Text style={styles.taxNote}>{item.taxRatePercent}% tax</Text>
              ) : null}
            </View>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>{money(item.unitPriceCents)}</Text>
            <Text style={styles.colAmount}>{money(lineSubtotalCents(item))}</Text>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={{ color: INK.muted }}>Subtotal</Text>
              <Text>{money(invoice.subtotalCents)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ color: INK.muted }}>
                Tax{singleRate !== null && singleRate > 0 ? ` (${singleRate}%)` : ""}
              </Text>
              <Text>{money(invoice.taxCents)}</Text>
            </View>

            {invoice.amountPaidCents > 0 ? (
              <View style={styles.totalRow}>
                <Text style={{ color: INK.muted }}>Paid</Text>
                <Text>-{money(invoice.amountPaidCents)}</Text>
              </View>
            ) : null}

            <View style={styles.grandRow}>
              <Text style={[styles.grandLabel, { marginTop: 6 }]}>
                {invoice.amountPaidCents > 0 ? "BALANCE DUE" : "TOTAL"}
              </Text>
              <Text style={styles.grandValue}>{money(balanceDue)}</Text>
            </View>
          </View>
        </View>

        {invoice.notes ? (
          <View style={{ marginTop: 34 }} wrap={false}>
            <Text style={styles.label}>NOTES</Text>
            <Text style={styles.notesBody}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.terms ? (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={styles.label}>TERMS</Text>
            <Text style={styles.notesBody}>{invoice.terms}</Text>
          </View>
        ) : null}

        {organization.paymentDetails?.method ? (
          <View style={{ marginTop: 30 }} wrap={false}>
            <Text style={styles.label}>PAYMENT DETAILS</Text>
            {organization.paymentDetails.showFullDetails &&
            (organization.paymentDetails.accountHolder ||
              organization.paymentDetails.bankName ||
              organization.paymentDetails.sortCode ||
              organization.paymentDetails.accountNumber) ? (
              <>
                <Text style={{ fontSize: SIZE.small, color: INK.muted, marginBottom: 2 }}>
                  Payment method: {organization.paymentDetails.method}
                </Text>
                <Text style={{ fontSize: SIZE.small, color: INK.body }}>
                  {[
                    organization.paymentDetails.accountHolder
                      ? `Account holder: ${organization.paymentDetails.accountHolder}`
                      : null,
                    organization.paymentDetails.bankName
                      ? `Bank: ${organization.paymentDetails.bankName}`
                      : null,
                    organization.paymentDetails.sortCode
                      ? `Sort code: ${organization.paymentDetails.sortCode}`
                      : null,
                    organization.paymentDetails.accountNumber
                      ? `Account No.: ${organization.paymentDetails.accountNumber}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("  ")}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: SIZE.small, color: INK.muted }}>
                Payment method: {organization.paymentDetails.method}
              </Text>
            )}
          </View>
        ) : null}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1
              ? `${organization.name} · Page ${pageNumber} of ${totalPages}`
              : organization.name
          }
        />
      </Page>
    </Document>
  );
}
