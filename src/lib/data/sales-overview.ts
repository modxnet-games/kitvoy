import { prisma } from "@/lib/db";
import { STORE_TIME_ZONE } from "@/lib/formatters";

/** Order fields the sales figures read. */
export interface SalesOrder {
  createdAt: Date;
  total: number;
  status: string;
}

export interface SalesDay {
  /** Store calendar day, "2026-10-31" */
  date: string;
  /** "Mon" … "Sun" */
  label: string;
  /** null for days of this week that haven't happened yet */
  revenue: number | null;
  orders: number;
}

export interface SalesOverview {
  timeZone: string;
  today: { date: string; revenue: number; orders: number };
  week: {
    start: string;
    end: string;
    days: SalesDay[];
    revenue: number;
    orders: number;
    /** Revenue on the same weekdays of the previous week (Monday through today's weekday) */
    previousRevenue: number;
    /** null when last week had no sales on those days */
    changePercent: number | null;
  };
  month: {
    label: string;
    start: string;
    revenue: number;
    orders: number;
    /**
     * Kept for the admin app, which reads every key. The store records no
     * costs any more, so nothing here can be computed: every figure is 0.
     */
    profit: {
      amount: number;
      estimated: boolean;
      ordersWithEstimates: number;
      productCost: number;
      shippingCost: number;
      paymentFees: number;
      refundCosts: number;
    };
  };
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The store calendar day of a moment, e.g. "2026-10-31" */
export const storeDayKey = (date: Date) => dayKeyFormat.format(date);

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6 */
const weekdayIndex = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** An order counts as a sale once it is delivered. */
const isSale = (o: SalesOrder) => o.status === "DELIVERED";

/**
 * Today, this calendar week (Mon–Sun) and this month, from delivered orders.
 * A sale belongs to the day its order was placed (createdAt).
 */
export function computeSalesOverview(orders: SalesOrder[], now = new Date()): SalesOverview {
  const today = storeDayKey(now);
  const todayIndex = weekdayIndex(today);
  const weekStart = addDays(today, -todayIndex);
  const prevWeekStart = addDays(weekStart, -7);
  const monthPrefix = today.slice(0, 7);

  const byDay = new Map<string, { revenue: number; orders: number }>();
  const month = { revenue: 0, orders: 0 };

  for (const order of orders) {
    if (!isSale(order)) continue;
    const day = storeDayKey(order.createdAt);
    const entry = byDay.get(day) ?? { revenue: 0, orders: 0 };
    entry.revenue += order.total;
    entry.orders += 1;
    byDay.set(day, entry);

    if (day.startsWith(monthPrefix)) {
      month.revenue += order.total;
      month.orders += 1;
    }
  }

  const days: SalesDay[] = DAY_LABELS.map((label, i) => {
    const date = addDays(weekStart, i);
    const entry = byDay.get(date);
    return { date, label, revenue: i > todayIndex ? null : round2(entry?.revenue ?? 0), orders: entry?.orders ?? 0 };
  });

  const weekRevenue = days.reduce((sum, d) => sum + (d.revenue ?? 0), 0);
  let previousRevenue = 0;
  for (let i = 0; i <= todayIndex; i++) previousRevenue += byDay.get(addDays(prevWeekStart, i))?.revenue ?? 0;

  return {
    timeZone: STORE_TIME_ZONE,
    today: { date: today, revenue: round2(byDay.get(today)?.revenue ?? 0), orders: byDay.get(today)?.orders ?? 0 },
    week: {
      start: weekStart,
      end: addDays(weekStart, 6),
      days,
      revenue: round2(weekRevenue),
      orders: days.reduce((sum, d) => sum + d.orders, 0),
      previousRevenue: round2(previousRevenue),
      changePercent: previousRevenue > 0 ? Math.round(((weekRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : null,
    },
    month: {
      label: new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      start: `${monthPrefix}-01`,
      revenue: round2(month.revenue),
      orders: month.orders,
      profit: { amount: 0, estimated: false, ordersWithEstimates: 0, productCost: 0, shippingCost: 0, paymentFees: 0, refundCosts: 0 },
    },
  };
}

export async function getSalesOverview(now = new Date()): Promise<SalesOverview> {
  const today = storeDayKey(now);
  const prevWeekStart = addDays(today, -weekdayIndex(today) - 7);
  const monthStart = `${today.slice(0, 7)}-01`;
  const earliest = prevWeekStart < monthStart ? prevWeekStart : monthStart;

  const orders = await prisma.order.findMany({
    // A day of margin covers the time zone offset; days are matched in computeSalesOverview
    where: { createdAt: { gte: new Date(`${addDays(earliest, -1)}T00:00:00Z`) }, status: "DELIVERED" },
    select: { createdAt: true, total: true, status: true },
  });
  return computeSalesOverview(orders, now);
}
