import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { siteConfig } from "@/config/site";
import { addressLineOf, getOrderById } from "@/lib/data/admin-orders";
import { formatDate, formatPrice } from "@/lib/formatters";
import { formatMoroccanPhone } from "@/lib/morocco";
import { orderReferenceOf } from "@/lib/order-reference";
import { OrderPrintClient } from "./print-client";

/*
 * The delivery slip that travels with the parcel. It is read by the courier
 * and the customer, so it is in French; the rest of the admin is in English.
 */

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PrintPageProps): Promise<Metadata> {
  const { id } = await params;
  // Also the file name a browser proposes for "Save as PDF"
  return { title: { absolute: `Bon de livraison ${orderReferenceOf(id)} - ${siteConfig.name}` } };
}

export default async function OrderPrintPage({ params }: PrintPageProps) {
  const { id } = await params;

  const order = await getOrderById(id);
  if (!order) notFound();

  const reference = orderReferenceOf(order.id);
  const date = formatDate(order.createdAt, "fr");
  const city = order.city?.trim() ?? "";
  // Without a city of its own, the one-line location is all there is
  const address = city ? addressLineOf(order) : order.location;
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <OrderPrintClient orderId={order.id} />

      <style>{`
        @media print {
          @page { size: A5; margin: 8mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .slip {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .slip * { page-break-inside: avoid; break-inside: avoid; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; }

        .slip {
          /* On screen the slip keeps clear of the edges of a phone */
          width: calc(100% - 24px);
          max-width: 520px;
          margin: 0 auto 24px;
          background: #fff;
          border: 2px solid #222;
          border-radius: 6px;
          overflow: hidden;
          /* Browsers leave backgrounds out of a print unless asked: without this the white-on-black label prints blank */
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media screen { .slip { box-shadow: 0 4px 24px rgba(0,0,0,.12); } }

        .slip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 12px 20px;
          border-bottom: 2px solid #111;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-logo { height: 58px; width: auto; display: block; }
        .brand-name { font-size: 22px; font-weight: 800; letter-spacing: .3px; }
        .slip-header .doc { text-align: right; }
        .slip-header .title { font-size: 15px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
        .slip-header .ref { font-family: monospace; font-size: 15px; font-weight: 700; margin-top: 2px; }
        .slip-header .date { font-size: 11px; color: #555; margin-top: 2px; }

        .label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #666;
        }

        .ship-to {
          border: 2px dashed #333;
          margin: 12px 16px;
          padding: 12px 16px;
          border-radius: 6px;
        }
        .ship-to .name {
          font-size: 20px;
          font-weight: 800;
          line-height: 1.2;
          margin: 6px 0 10px;
        }
        .ship-to .rows { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: baseline; }
        .ship-to .rows dt { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #666; }
        .ship-to .rows dd { font-size: 13px; line-height: 1.4; color: #222; }
        .ship-to .rows dd.phone { font-size: 16px; font-weight: 700; font-family: monospace; }
        .ship-to .rows dd.city { font-size: 16px; font-weight: 800; text-transform: uppercase; }

        .cod-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 0 16px 10px;
          padding: 10px 16px;
          border: 2px solid #111;
          border-radius: 6px;
          background: #f9f9f6;
        }
        .cod-box .badge {
          display: inline-block;
          background: #111;
          color: #fff;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .5px;
          text-transform: uppercase;
        }
        .cod-box .due { text-align: right; }
        .cod-box .due-label { font-size: 11px; font-weight: 700; }
        .cod-box .amount { font-size: 22px; font-weight: 900; font-family: monospace; white-space: nowrap; }

        .cut-line { margin: 0 16px 8px; border: none; border-top: 1px dashed #ccc; }

        .items-section { margin: 0 16px 12px; }
        /* display: the site's stylesheet turns tables into scrolling blocks on narrow pages, and an A5 sheet is one */
        .items-table { display: table; width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
        .items-table th {
          text-align: left;
          padding: 6px 8px;
          background: #eee;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .5px;
          border-bottom: 1px solid #ccc;
        }
        .items-table th.r, .items-table td.r { text-align: right; }
        .items-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        .items-table .total-row td {
          border-top: 2px solid #111;
          border-bottom: none;
          font-weight: 800;
          padding-top: 8px;
          font-size: 13px;
        }

        .slip-footer {
          padding: 8px 20px;
          background: #f5f5f5;
          text-align: center;
          font-size: 10px;
          color: #777;
          border-top: 1px solid #ddd;
        }
      `}</style>

      <div className="slip" lang="fr">
        <div className="slip-header">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- a printed page: the plain file, no lazy loading */}
            <img className="brand-logo" src={siteConfig.logo} alt="" />
            <span className="brand-name">{siteConfig.name}</span>
          </div>
          <div className="doc">
            <div className="title">Bon de livraison</div>
            <div className="ref">{reference}</div>
            <div className="date">{date}</div>
          </div>
        </div>

        <div className="ship-to">
          <div className="label">Client</div>
          <div className="name" dir="auto">
            {order.customerName}
          </div>
          <dl className="rows">
            <dt>Téléphone</dt>
            <dd className="phone">{formatMoroccanPhone(order.phone)}</dd>
            {city && (
              <>
                <dt>Ville</dt>
                <dd className="city" dir="auto">
                  {city}
                </dd>
              </>
            )}
            <dt>Adresse</dt>
            <dd dir="auto">{address}</dd>
            {order.trackingNumber && (
              <>
                <dt>Suivi</dt>
                <dd style={{ fontFamily: "monospace" }}>{order.trackingNumber}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="cod-box">
          <span className="badge">Paiement à la livraison</span>
          <div className="due">
            <span className="due-label">Montant à encaisser : </span>
            <span className="amount">{formatPrice(order.total)}</span>
          </div>
        </div>

        <hr className="cut-line" />

        <div className="items-section">
          <div className="label">Articles</div>
          <table className="items-table">
            <thead>
              <tr>
                <th>Articles</th>
                <th className="r">Quantité</th>
                <th className="r">Prix</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td className="r">{item.quantity}</td>
                  <td className="r">{formatPrice(item.lineTotal)}</td>
                </tr>
              ))}
              <tr>
                <td>Livraison</td>
                <td className="r" />
                <td className="r">{order.shippingCost === 0 ? "Gratuite" : formatPrice(order.shippingCost)}</td>
              </tr>
              <tr className="total-row">
                <td>Total</td>
                <td className="r">{pieces}</td>
                <td className="r">{formatPrice(order.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="slip-footer">
          {siteConfig.name} &middot; {reference} &middot; {date}
        </div>
      </div>
    </>
  );
}
