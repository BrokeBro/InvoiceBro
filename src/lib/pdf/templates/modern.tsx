import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/dates";
import { formatMoney, lineSubtotalCents } from "@/lib/money";
import { FONT, INK, PAGE, SIZE, readableTextOn, tintOf } from "@/lib/pdf/theme";
import type { PdfDocumentProps } from "@/lib/pdf/types";

// MODERN — a full-bleed accent banner, generous whitespace, no table rules.
// Separation comes from spacing and a zebra tint rather than lines.

const styles = StyleSheet.create({
  page: {
    paddingBottom: PAGE.padding + 24,
    fontFamily: FONT.body,
    fontSize: SIZE.body,
    color: INK.body,
    // No page-level lineHeight — see the note in theme.ts: it silently breaks
    // <Text render={…}>, which is how the page-number footer is drawn.
  },
  banner: {
    paddingHorizontal: PAGE.padding,
    paddingTop: 34,
    paddingBottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
  },
  logo: { width: 108, maxHeight: 46, objectFit: "contain", marginBottom: 8 },
  orgName: { fontFamily: FONT.bold, fontSize: SIZE.heading },
  orgLine: { fontSize: SIZE.small, opacity: 0.85 },
  // Fixed width + right alignment stops the invoice number being painted on
  // top of the title (react-pdf under-measures letter-spaced display text).
  titleBlock: { width: 190 },
  title: {
    fontFamily: FONT.bold,
    fontSize: SIZE.display,
    letterSpacing: -0.5,
    lineHeight: 1.2,
    textAlign: "right",
  },
  number: { fontSize: SIZE.body, opacity: 0.85, textAlign: "right" },

  body: { paddingHorizontal: PAGE.padding },

  cards: { flexDirection: "row", gap: PAGE.gutter, marginBottom: 28 },
  card: { flex: 1 },
  cardWide: { flex: 1.3 },
  label: {
    fontFamily: FONT.bold,
    fontSize: SIZE.micro,
    letterSpacing: 1,
    color: INK.faint,
    marginBottom: 5,
  },
  strong: { fontFamily: FONT.bold, color: INK.strong },
  dueAmount: { fontFamily: FONT.bold, fontSize: SIZE.heading },

  tableHead: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 7 },
  row: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 9 },
  colDescription: { width: "46%", paddingRight: 8 },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "17%", textAlign: "right" },
  colTax: { width: "10%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  headText: { fontFamily: FONT.bold, fontSize: SIZE.micro, letterSpacing: 0.8 },

  totals: { marginTop: 20, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "48%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    padding: 12,
    borderRadius: 6,
  },
  grandText: { fontFamily: FONT.bold, fontSize: SIZE.lead },

  notes: { marginTop: 32, padding: 14, borderRadius: 6 },
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

export function ModernTemplate({
  invoice,
  organization,
  logoUrl,
  accentColor,
}: PdfDocumentProps) {
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const balanceDue = invoice.totalCents - invoice.amountPaidCents;

  // The accent is user-chosen, so banner text has to adapt — white on a pale
  // accent would be invisible.
  const onAccent = readableTextOn(accentColor);
  const zebra = tintOf(accentColor, 0.05);

  return (
    <Document
      title={`Invoice ${invoice.number ?? "draft"}`}
      author={organization.name}
      subject={`Invoice for ${invoice.client.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={[styles.banner, { backgroundColor: accentColor }]}>
          <View>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: onAccent }]}>Invoice</Text>
            <Text style={[styles.orgName, { color: onAccent, textAlign: "right" }]}>{organization.name}</Text>
            {organization.address && organization.visibility?.showAddress !== false ? (
              <Text style={[styles.orgLine, { color: onAccent, textAlign: "right" }]}>{organization.address}</Text>
            ) : null}
            {organization.email ? (
              <Text style={[styles.orgLine, { color: onAccent, textAlign: "right" }]}>{organization.email}</Text>
            ) : null}
            {organization.vatNumber ? (
              <Text style={[styles.orgLine, { color: onAccent, textAlign: "right" }]}>
                VAT {organization.vatNumber}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.cards}>
            <View style={styles.cardWide}>
              <Text style={styles.label}>BILLED TO</Text>
              <Text style={styles.strong}>{invoice.client.name}</Text>
              {invoice.client.address ? <Text>{invoice.client.address}</Text> : null}
              {invoice.client.email ? <Text>{invoice.client.email}</Text> : null}
              {/* Only when they are actually VAT registered — an unregistered
                  client has no number to show under their address. */}
              {invoice.client.vatRegistered && invoice.client.vatNumber ? (
                <Text>VAT {invoice.client.vatNumber}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>ISSUED</Text>
              <Text style={styles.strong}>{formatDate(invoice.issueDate)}</Text>
              <Text style={[styles.label, { marginTop: 10 }]}>DUE</Text>
              <Text style={styles.strong}>{formatDate(invoice.dueDate)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>INVOICE NO.</Text>
              <Text style={styles.strong}>{invoice.number ?? "DRAFT"}</Text>
            </View>
          </View>

          {/* Not `fixed`: react-pdf would repeat it on the totals/notes page
              too, printing a column header above no rows at all. */}
          <View style={[styles.tableHead, { backgroundColor: accentColor }]}>
            <Text style={[styles.colDescription, styles.headText, { color: onAccent }]}>
              DESCRIPTION
            </Text>
            <Text style={[styles.colQty, styles.headText, { color: onAccent }]}>QTY</Text>
            <Text style={[styles.colRate, styles.headText, { color: onAccent }]}>RATE</Text>
            <Text style={[styles.colTax, styles.headText, { color: onAccent }]}>TAX</Text>
            <Text style={[styles.colAmount, styles.headText, { color: onAccent }]}>
              AMOUNT
            </Text>
          </View>

          {invoice.lineItems.map((item, index) => (
            <View
              key={index}
              style={[
                styles.row,
                index % 2 === 1 ? { backgroundColor: zebra } : {},
              ]}
              wrap={false}
            >
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

              <View style={[styles.grandRow, { backgroundColor: accentColor }]}>
                <Text style={[styles.grandText, { color: onAccent }]}>
                  {invoice.amountPaidCents > 0 ? "Balance due" : "Total"}
                </Text>
                <Text style={[styles.grandText, { color: onAccent }]}>
                  {money(balanceDue)}
                </Text>
              </View>
            </View>
          </View>

          {invoice.notes || invoice.terms ? (
            <View style={[styles.notes, { backgroundColor: zebra }]} wrap={false}>
              {invoice.notes ? (
                <>
                  <Text style={styles.label}>NOTES</Text>
                  <Text style={styles.notesBody}>{invoice.notes}</Text>
                </>
              ) : null}
              {invoice.terms ? (
                <>
                  <Text style={[styles.label, invoice.notes ? { marginTop: 10 } : {}]}>
                    TERMS
                  </Text>
                  <Text style={styles.notesBody}>{invoice.terms}</Text>
                </>
              ) : null}
            </View>
          ) : null}

        </View>

        <View style={styles.footer} fixed>
          {organization.paymentDetails?.method ? (
            <>
              <Text style={{ fontFamily: FONT.bold, fontSize: SIZE.micro, letterSpacing: 1, color: INK.faint, marginBottom: 2, textAlign: "left" }}>
                PAYMENT DETAILS
              </Text>
              {organization.paymentDetails.showFullDetails &&
              (organization.paymentDetails.accountHolder ||
                organization.paymentDetails.bankName ||
                organization.paymentDetails.sortCode ||
                organization.paymentDetails.accountNumber) ? (
                <Text style={{ fontSize: SIZE.micro, color: INK.muted, textAlign: "left" }}>
                  Account holder: {organization.paymentDetails.accountHolder}
                  {"  "}Bank: {organization.paymentDetails.bankName}
                  {"  "}Sort code: {organization.paymentDetails.sortCode}
                  {"  "}Account No.: {organization.paymentDetails.accountNumber}
                </Text>
              ) : (
                <Text style={{ fontSize: SIZE.micro, color: INK.muted, textAlign: "left" }}>
                  Payment method: {organization.paymentDetails.method}
                </Text>
              )}
            </>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
