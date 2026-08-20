"use client";

import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/money";
import type { Invoice } from "@/lib/types";

type Period = "month" | "quarter" | "half" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  month: "This month",
  quarter: "This quarter",
  half: "Last 6 months",
  year: "This year",
};

function periodRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let start: Date;
  switch (period) {
    case "month":
      start = new Date(y, m, 1);
      break;
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      start = new Date(y, q, 1);
      break;
    }
    case "half":
      start = new Date(y, m - 5, 1);
      break;
    case "year":
      start = new Date(y, 0, 1);
      break;
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

function filterByPeriod(invoices: Invoice[], period: Period): Invoice[] {
  const { start, end } = periodRange(period);
  return invoices.filter(
    (inv) => inv.issueDate >= start && inv.issueDate <= end,
  );
}

export function MetricsDashboard({
  invoices,
  currency,
}: {
  invoices: Invoice[];
  currency: string;
}) {
  const [period, setPeriod] = useState<Period>("month");

  const filtered = useMemo(
    () => filterByPeriod(invoices, period),
    [invoices, period],
  );

  const stats = useMemo(() => {
    let totalIssued = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let countPaid = 0;
    let countPending = 0;

    for (const inv of filtered) {
      if (inv.status === "draft" || inv.status === "void") continue;
      totalIssued += inv.totalCents;
      if (inv.status === "paid") {
        totalPaid += inv.totalCents;
        countPaid++;
      } else {
        totalPending += inv.balanceCents;
        countPending++;
      }
    }

    return { totalIssued, totalPaid, totalPending, countPaid, countPending };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              period === p
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          label="Total issued"
          value={formatMoney(stats.totalIssued, currency)}
          sub={`${filtered.filter((i) => i.status !== "draft" && i.status !== "void").length} invoices`}
          color="text-slate-900"
        />
        <Card
          label="Paid"
          value={formatMoney(stats.totalPaid, currency)}
          sub={`${stats.countPaid} invoice${stats.countPaid !== 1 ? "s" : ""}`}
          color="text-emerald-600"
        />
        <Card
          label="Pending"
          value={formatMoney(stats.totalPending, currency)}
          sub={`${stats.countPending} invoice${stats.countPending !== 1 ? "s" : ""}`}
          color="text-amber-600"
        />
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Invoice activity
        </h2>
        <Heatmap invoices={invoices} period={period} />
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function Heatmap({
  invoices,
  period,
}: {
  invoices: Invoice[];
  period: Period;
}) {
  const { start, end } = periodRange(period);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === "void") continue;
      const d = inv.issueDate;
      if (d >= start && d <= end) {
        map.set(d, (map.get(d) ?? 0) + 1);
      }
    }
    return map;
  }, [invoices, start, end]);

  const maxCount = useMemo(
    () => Math.max(1, ...counts.values()),
    [counts],
  );

  const { weeks, monthLabels } = useMemo(() => {
    const startDate = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");

    // Align start to previous Monday
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const alignedStart = new Date(startDate);
    alignedStart.setDate(alignedStart.getDate() + mondayOffset);

    const weeks: { date: string; count: number; inRange: boolean }[][] = [];
    const monthLabels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;

    const cursor = new Date(alignedStart);
    while (cursor <= endDate || cursor.getDay() !== 1) {
      if (cursor > endDate && cursor.getDay() === 1) break;

      const weekDay = cursor.getDay();
      const idx = weekDay === 0 ? 6 : weekDay - 1; // Mon=0 ... Sun=6

      if (idx === 0) weeks.push([]);

      const dateStr = cursor.toISOString().slice(0, 10);
      const inRange = dateStr >= start && dateStr <= end;

      weeks[weeks.length - 1].push({
        date: dateStr,
        count: counts.get(dateStr) ?? 0,
        inRange,
      });

      if (cursor.getMonth() !== lastMonth && inRange) {
        lastMonth = cursor.getMonth();
        monthLabels.push({
          weekIndex: weeks.length - 1,
          label: MONTH_NAMES[cursor.getMonth()],
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return { weeks, monthLabels };
  }, [start, end, counts]);

  return (
    <div className="overflow-x-auto">
      {/* Month labels */}
      <div className="mb-1 flex" style={{ paddingLeft: 28 }}>
        {monthLabels.map((ml, i) => {
          const nextWeek =
            i + 1 < monthLabels.length
              ? monthLabels[i + 1].weekIndex
              : weeks.length;
          const span = nextWeek - ml.weekIndex;
          return (
            <div
              key={`${ml.label}-${ml.weekIndex}`}
              className="text-xs text-slate-400"
              style={{ width: span * 14 }}
            >
              {span >= 2 ? ml.label : ""}
            </div>
          );
        })}
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex shrink-0 flex-col gap-0.5" style={{ width: 24 }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="flex items-center text-xs text-slate-400"
              style={{ height: 12 }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="flex gap-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day) => {
                if (!day.inRange) {
                  return (
                    <div
                      key={day.date}
                      className="rounded-sm"
                      style={{ width: 12, height: 12 }}
                    />
                  );
                }

                const intensity =
                  day.count === 0
                    ? 0
                    : Math.min(4, Math.ceil((day.count / maxCount) * 4));

                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} invoice${day.count !== 1 ? "s" : ""}`}
                    className={`rounded-sm ${HEAT_COLORS[intensity]}`}
                    style={{ width: 12, height: 12 }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-slate-400">
        <span>Less</span>
        {HEAT_COLORS.map((cls, i) => (
          <div
            key={i}
            className={`rounded-sm ${cls}`}
            style={{ width: 12, height: 12 }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

const HEAT_COLORS = [
  "bg-slate-100",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
];
