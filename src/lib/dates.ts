// Dates on an invoice are calendar dates, not instants.
//
// An invoice issued on 2026-08-16 was issued on that date everywhere in the
// world; storing a UTC timestamp would render as the 15th for anyone west of
// Greenwich. So issueDate and dueDate are stored as "YYYY-MM-DD" strings, which
// also sort correctly as plain text in Firestore queries.

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-08-16" -> "16 Aug 2026" */
export function formatDate(isoDate: string, locale = "en-GB"): string {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
