/**
 * Fills in paymentFee (from PayPal) and supplierProductCost / supplierShippingCost
 * (from CJ) on orders paid before those fields were recorded.
 *
 *   node --import tsx scripts/backfill-order-costs.ts
 *
 * Safe to run again: only orders still missing a value are looked up.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { cjCostFields, describeCjError, getCjOrder } from "../src/lib/fulfillment/cj-client";
import { getPayPal, paypal } from "../src/lib/payments/paypal";

type Money = { value?: string };
type Capture = { id?: string; seller_receivable_breakdown?: { paypal_fee?: Money } };

const feeOf = (capture: Capture | undefined) => {
  const fee = Number(capture?.seller_receivable_breakdown?.paypal_fee?.value);
  return Number.isFinite(fee) ? fee : undefined;
};

async function paypalFee(client: NonNullable<ReturnType<typeof getPayPal>>, ref: string) {
  // Newer orders store the capture id; older ones the PayPal order id
  try {
    return feeOf((await client.execute(new paypal.payments.CapturesGetRequest(ref))).result as Capture);
  } catch {
    const order = (await client.execute(new paypal.orders.OrdersGetRequest(ref))).result as {
      purchase_units?: { payments?: { captures?: Capture[] } }[];
    };
    return feeOf(order.purchase_units?.[0]?.payments?.captures?.[0]);
  }
}

async function main() {
  const client = getPayPal();
  const feeOrders = await prisma.order.findMany({
    where: { paymentMethod: "paypal", paymentStatus: { in: ["paid", "refunded"] }, paymentFee: null, paymentRef: { not: null } },
    select: { id: true, paymentRef: true },
  });
  let fees = 0;
  for (const order of client ? feeOrders : []) {
    try {
      const fee = await paypalFee(client!, order.paymentRef!);
      if (fee === undefined) continue;
      await prisma.order.update({ where: { id: order.id }, data: { paymentFee: fee } });
      fees++;
    } catch (err) {
      console.warn(`PayPal fee for ${order.id}: ${(err as Error).message}`);
    }
  }
  console.log(`PayPal fees recorded: ${fees} of ${feeOrders.length}${client ? "" : " (PayPal isn't configured)"}`);

  const cjOrders = await prisma.order.findMany({
    where: { fulfillmentRef: { not: null }, OR: [{ supplierProductCost: null }, { supplierShippingCost: null }] },
    select: { id: true, fulfillmentRef: true },
  });
  let cj = 0;
  for (const order of cjOrders) {
    try {
      const costs = cjCostFields(await getCjOrder(order.fulfillmentRef!));
      if (!Object.keys(costs).length) continue;
      await prisma.order.update({ where: { id: order.id }, data: costs });
      cj++;
    } catch (err) {
      console.warn(`CJ costs for ${order.id}: ${describeCjError(err)}`);
    }
  }
  console.log(`CJ costs recorded: ${cj} of ${cjOrders.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
