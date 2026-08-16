import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/dates";
import { formatMoney, lineSubtotalCents } from "@/lib/money";
import { FONT, INK, PAGE, SIZE, tintOf } from "@/lib/pdf/theme";
import type { PdfDocumentProps } from "@/lib/pdf/types";

// CLASSIC — a traditional business invoice. Serif-free but formal: ruled table,
// right-aligned totals block, everything where an accountant expects it.

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE.padding,
    paddingBottom: PAGE.padding + 24,
    paddingHorizontal: PAGE.padding,
    fontFamily: FONT.body,
    fontSize: SIZE.body,
    color: INK.body,
    // NOTE: no `lineHeight` anywhere in this file, on purpose. In
    // @react-pdf/renderer 4.6.1 a <Text render={…}> paints nothing when it
    // inherits a lineHeight from its page — the callback still fires, so it
    // fails silently and the page-number footer simply vanishes. Setting it on
    // individual text styles avoids that but spaces lines far wider than the
    // multiplier suggests, so the renderer's own metrics-derived leading is
    // what we use. See theme.ts.
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  logo: { width: 116, maxHeight: 52, objectFit: "contain" },
  orgName: { fontFamily: FONT.bold, fontSize: SIZE.lead, color: INK.strong },
  orgLine: { fontSize: SIZE.small, color: INK.muted },
  // Explicit width + textAlign rather than alignItems: "flex-end". react-pdf
  // measures letter-spaced text narrower than it actually draws, so a
  // shrink-to-fit column ends up narrower than the title and the invoice number
  // gets painted on top of it.
  titleBlock: { width: 200 },
  title: {
    fontFamily: FONT.bold,
    fontSize: SIZE.display,
    letterSpacing: 1.5,
    lineHeight: 1.2,
    color: INK.strong,
    textAlign: "right",
  },
  number: { fontSize: SIZE.body, color: INK.muted, marginTop: 3, textAlign: "right" },

  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  metaColumn: { width: "48%" },
  metaLabel: {
    fontFamily: FONT.bold,
    fontSize: SIZE.micro,
    letterSpacing: 0.8,
    color: INK.faint,
    marginBottom: 4,
  },
  metaStrong: { fontFamily: FONT.bold, color: INK.strong },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },

  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: INK.strong,
    paddingBottom: 6,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: INK.hairline,
    paddingVertical: 7,
  },
  colDescription: { width: "46%", paddingRight: 8 },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "17%", textAlign: "right" },
  colTax: { width: "10%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  headText: {
    fontFamily: FONT.bold,
    fontSize: SIZE.micro,
    letterSpacing: 0.8,
    color: INK.strong,
  },

  totals: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderTopWidth: 1.5,
    borderTopColor: INK.strong,
  },
  grandLabel: { fontFamily: FONT.bold, fontSize: SIZE.lead, color: INK.strong },

  notes: { marginTop: 30 },
  notesLabel: {
    fontFamily: FONT.bold,
    fontSize: SIZE.micro,
    letterSpacing: 0.8,
    color: INK.faint,
    marginBottom: 3,
  },
  notesBody: { fontSize: SIZE.small, color: INK.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: PAGE.padding,
    right: PAGE.padding,
    textAlign: "center",
    fontSize: SIZE.micro,
    color: INK.faint,
  },
});

export function ClassicTemplate({
  invoice,
  organization,
  logoUrl,
  accentColor,
}: PdfDocumentProps) {
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const balanceDue = invoice.totalCents - invoice.amountPaidCents;

  return (
    <Document
      title={`Invoice ${invoice.number ?? "draft"}`}
      author={organization.name}
      subject={`Invoice for ${invoice.client.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.orgName}>{organization.name}</Text>
            )}
            {logoUrl ? <Text style={[styles.orgName, { marginTop: 6 }]}>{organization.name}</Text> : null}
            {organization.address ? (
              <Text style={styles.orgLine}>{organization.address}</Text>
            ) : null}
            {organization.email ? (
              <Text style={styles.orgLine}>{organization.email}</Text>
            ) : null}
            {organization.phone ? (
              <Text style={styles.orgLine}>{organization.phone}</Text>
            ) : null}
            {organization.vatNumber ? (
              <Text style={styles.orgLine}>VAT {organization.vatNumber}</Text>
            ) : null}
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: accentColor }]}>INVOICE</Text>
            <Text style={styles.number}>{invoice.number ?? "DRAFT"}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaColumn}>
            <Text style={styles.metaLabel}>BILL TO</Text>
            <Text style={styles.metaStrong}>{invoice.client.name}</Text>
            {invoice.client.address ? <Text>{invoice.client.address}</Text> : null}
            {invoice.client.email ? <Text>{invoice.client.email}</Text> : null}
            {invoice.client.vatNumber ? (
              <Text>VAT {invoice.client.vatNumber}</Text>
            ) : null}
          </View>

          <View style={styles.metaColumn}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>ISSUE DATE</Text>
              <Text>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>DUE DATE</Text>
              <Text style={styles.metaStrong}>{formatDate(invoice.dueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>AMOUNT DUE</Text>
              <Text style={styles.metaStrong}>{money(balanceDue)}</Text>
            </View>
          </View>
        </View>

        {/* Deliberately not `fixed`. react-pdf repeats a fixed element on every
            page unconditionally, including pages that carry only the totals or
            notes — which printed a column header above nothing at all. */}
        <View style={styles.tableHead}>
          <Text style={[styles.colDescription, styles.headText]}>DESCRIPTION</Text>
          <Text style={[styles.colQty, styles.headText]}>QTY</Text>
          <Text style={[styles.colRate, styles.headText]}>RATE</Text>
          <Text style={[styles.colTax, styles.headText]}>TAX</Text>
          <Text style={[styles.colAmount, styles.headText]}>AMOUNT</Text>
        </View>

        {invoice.lineItems.map((item, index) => (
          // wrap={false} keeps a single line item from splitting across pages.
          <View key={index} style={styles.row} wrap={false}>
            <Text style={styles.colDescription}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>{money(item.unitPriceCents)}</Text>
            <Text style={styles.colTax}>{item.taxRatePercent}%</Text>
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
              <Text style={{ color: INK.muted }}>Tax</Text>
              <Text>{money(invoice.taxCents)}</Text>
            </View>

            {invoice.amountPaidCents > 0 ? (
              <View style={styles.totalRow}>
                <Text style={{ color: INK.muted }}>Paid</Text>
                <Text>-{money(invoice.amountPaidCents)}</Text>
              </View>
            ) : null}

            <View style={[styles.grandRow, { backgroundColor: tintOf(accentColor, 0.12) }]}>
              <Text style={styles.grandLabel}>
                {invoice.amountPaidCents > 0 ? "Balance due" : "Total"}
              </Text>
              <Text style={[styles.grandLabel, { color: accentColor }]}>
                {money(balanceDue)}
              </Text>
            </View>
          </View>
        </View>

        {invoice.notes ? (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Text style={styles.notesBody}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.terms ? (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={styles.notesLabel}>TERMS</Text>
            <Text style={styles.notesBody}>{invoice.terms}</Text>
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
