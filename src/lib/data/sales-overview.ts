import { siteConfig } from "@/config/site";
import { countOrdersByStatus, listOrders, serializeOrder, type SerializedOrder, type StatusCounts } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";
import { STORE_TIME_ZONE } from "@/lib/formatters";

/*
 * The dashboard's figures, all from cash-on-delivery orders and all in the
 * store's time zone (Morocco).
 *
 * Two sets live side by side. The first (SalesOverview) is what the route
 * returned before the store sold cash on delivery; an older version of the
 * admin app reads every key of it, so it keeps its shape. The second
 * (CodOverview, the route's `cod` object) is what a cash-on-delivery shop
 * actually steers by: who to call, what to ship, what was collected.
 */

/** Order fields the sales figures read. */
export interface SalesOrder {
  createdAt: Date;
  /** When the order was delivered and its cash collected; without it the order counts on the day it was placed */
  deliveredAt?: Date | null;
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
 * A sale belongs to the day the order was delivered: with cash on delivery
 * that is the day the money came in, and what `cod` calls deliveredRevenue.
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
    const day = storeDayKey(order.deliveredAt ?? order.createdAt);
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

/** The older app's figures, from delivered cash-on-delivery orders. */
export async function getSalesOverview(now = new Date()): Promise<SalesOverview> {
  const today = storeDayKey(now);
  const prevWeekStart = addDays(today, -weekdayIndex(today) - 7);
  const monthStart = `${today.slice(0, 7)}-01`;
  const earliest = prevWeekStart < monthStart ? prevWeekStart : monthStart;

  // A day of margin covers the time zone offset; days are matched in computeSalesOverview
  const since = new Date(`${addDays(earliest, -1)}T00:00:00Z`);
  const orders = await prisma.order.findMany({
    where: {
      paymentMethod: "cod",
      status: "DELIVERED",
      OR: [{ deliveredAt: { gte: since } }, { deliveredAt: null, createdAt: { gte: since } }],
    },
    select: { createdAt: true, deliveredAt: true, total: true, status: true },
  });
  return computeSalesOverview(orders, now);
}

/* ------------------------------------------------------------------ */
/*  Cash on delivery                                                   */
/* ------------------------------------------------------------------ */

/** What the cash-on-delivery figures read from an order. */
export interface CodOrderFacts {
  status: string;
  total: number;
  createdAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
}

export interface CodDay {
  /** Store calendar day, "2026-11-22" */
  date: string;
  /** Orders placed that day, whatever became of them, and what they are worth */
  orders: number;
  value: number;
  /** Orders delivered that day, and the cash collected for them */
  delivered: number;
  deliveredRevenue: number;
}

export interface CodActivity {
  today: {
    orders: number;
    value: number;
    /** Confirmed today and still confirmed, shipped, delivered or returned */
    confirmed: number;
    delivered: number;
    deliveredRevenue: number;
  };
  month: {
    orders: number;
    value: number;
    delivered: number;
    deliveredRevenue: number;
    /** Of the orders placed this month */
    returned: number;
    canceled: number;
    /** Share (0 to 1) of this month's orders that were confirmed; null when there are none */
    confirmationRate: number | null;
    /** Of this month's orders that reached an end, the share (0 to 1) delivered rather than returned; null when none has */
    deliveryRate: number | null;
  };
  /** The last 7 days, oldest first, today last */
  days: CodDay[];
}

export interface CodOverview extends CodActivity {
  currency: string;
  timeZone: string;
  /** Every order, by status */
  counts: StatusCounts;
  /** PENDING + NO_ANSWER */
  toCall: number;
  /** CONFIRMED */
  toShip: number;
  /** SHIPPED */
  inDelivery: number;
  /** The newest orders */
  recent: SerializedOrder[];
}

/** A customer who said yes on the phone, whatever happened to the parcel afterwards. */
const CONFIRMED_STATUSES = new Set(["CONFIRMED", "SHIPPED", "DELIVERED", "RETURNED"]);

const toCents = (amount: number) => Math.round(amount * 100);
const ratio = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 10000) / 10000 : null);

/**
 * Today, this month and the last 7 days. An order and its value belong to the
 * day it was placed (createdAt); a delivery and its cash to the day it was
 * delivered (deliveredAt). The two rates look at the orders placed this month
 * and where they stand now.
 */
export function computeCodActivity(orders: CodOrderFacts[], now = new Date()): CodActivity {
  const today = storeDayKey(now);
  const monthPrefix = today.slice(0, 7);

  // Money is added up in centimes, so the sums stay exact
  const tally = () => ({ orders: 0, valueCents: 0, delivered: 0, deliveredCents: 0 });
  const days = new Map<string, ReturnType<typeof tally>>();
  for (let back = 6; back >= 0; back--) days.set(addDays(today, -back), tally());
  const month = tally();
  // Where the orders placed this month stand now
  const placed = { confirmed: 0, delivered: 0, returned: 0, canceled: 0 };
  let confirmedToday = 0;

  for (const order of orders) {
    const cents = toCents(order.total);
    const confirmed = CONFIRMED_STATUSES.has(order.status);

    const placedOn = storeDayKey(order.createdAt);
    const placedDay = days.get(placedOn);
    if (placedDay) {
      placedDay.orders += 1;
      placedDay.valueCents += cents;
    }
    if (placedOn.startsWith(monthPrefix)) {
      month.orders += 1;
      month.valueCents += cents;
      if (confirmed) placed.confirmed += 1;
      if (order.status === "DELIVERED") placed.delivered += 1;
      if (order.status === "RETURNED") placed.returned += 1;
      if (order.status === "CANCELED") placed.canceled += 1;
    }

    if (confirmed && order.confirmedAt && storeDayKey(order.confirmedAt) === today) confirmedToday += 1;

    if (order.status === "DELIVERED" && order.deliveredAt) {
      const deliveredOn = storeDayKey(order.deliveredAt);
      const deliveredDay = days.get(deliveredOn);
      if (deliveredDay) {
        deliveredDay.delivered += 1;
        deliveredDay.deliveredCents += cents;
      }
      if (deliveredOn.startsWith(monthPrefix)) {
        month.delivered += 1;
        month.deliveredCents += cents;
      }
    }
  }

  const todayTally = days.get(today) ?? tally();
  return {
    today: {
      orders: todayTally.orders,
      value: todayTally.valueCents / 100,
      confirmed: confirmedToday,
      delivered: todayTally.delivered,
      deliveredRevenue: todayTally.deliveredCents / 100,
    },
    month: {
      orders: month.orders,
      value: month.valueCents / 100,
      delivered: month.delivered,
      deliveredRevenue: month.deliveredCents / 100,
      returned: placed.returned,
      canceled: placed.canceled,
      confirmationRate: ratio(placed.confirmed, month.orders),
      deliveryRate: ratio(placed.delivered, placed.delivered + placed.returned),
    },
    days: [...days].map(([date, d]) => ({ date, orders: d.orders, value: d.valueCents / 100, delivered: d.delivered, deliveredRevenue: d.deliveredCents / 100 })),
  };
}

const RECENT_ORDERS = 8;

/** What the dashboard home and the app's home screen show. */
export async function getCodOverview(now = new Date()): Promise<CodOverview> {
  const today = storeDayKey(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = addDays(today, -6);
  const earliest = weekStart < monthStart ? weekStart : monthStart;
  // A day of margin covers the time zone offset; days are matched in computeCodActivity
  const since = new Date(`${addDays(earliest, -1)}T00:00:00Z`);

  const [facts, counts, recent] = await Promise.all([
    prisma.order.findMany({
      where: { paymentMethod: "cod", OR: [{ createdAt: { gte: since } }, { confirmedAt: { gte: since } }, { deliveredAt: { gte: since } }] },
      select: { status: true, total: true, createdAt: true, confirmedAt: true, deliveredAt: true },
    }),
    countOrdersByStatus(),
    listOrders({ limit: RECENT_ORDERS }),
  ]);

  return {
    currency: siteConfig.currency,
    timeZone: STORE_TIME_ZONE,
    counts,
    toCall: counts.PENDING + counts.NO_ANSWER,
    toShip: counts.CONFIRMED,
    inDelivery: counts.SHIPPED,
    ...computeCodActivity(facts, now),
    recent: recent.map(serializeOrder),
  };
}

/** GET /api/admin/dashboard/overview: the older app's keys, and the cash-on-delivery figures under `cod`. */
export async function getDashboardOverview(now = new Date()): Promise<SalesOverview & { cod: CodOverview }> {
  const [sales, cod] = await Promise.all([getSalesOverview(now), getCodOverview(now)]);
  return { ...sales, cod };
}
