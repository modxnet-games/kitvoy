import type { ReactNode } from "react";

/**
 * Payment-method badges drawn as vectors (uniform rounded cards), and the
 * small stroke icons of the trust row. Only methods this store really takes
 * are listed: cards through Stripe, Apple Pay and Google Pay (kitvoy.com is a
 * registered payment method domain with both active, checked 2026-11-15) and
 * PayPal.
 */

const W = 46;
const H = 30;
const F = "Arial, Helvetica, sans-serif";

function Card({ label, bg = "#fff", stroke = "#D9D9D9", children }: { label: string; bg?: string; stroke?: string; children: ReactNode }) {
  return (
    <svg className="kv-paybadge" role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <title>{label}</title>
      <rect x=".5" y=".5" width={W - 1} height={H - 1} rx="4.5" fill={bg} stroke={stroke} />
      {children}
    </svg>
  );
}

const Visa = () => (
  <Card label="Visa">
    <text x="23" y="20.2" textAnchor="middle" fontFamily={F} fontSize="13.5" fontWeight="900" fontStyle="italic" fill="#1434CB" letterSpacing=".4">VISA</text>
  </Card>
);
const Mastercard = () => (
  <Card label="Mastercard">
    <circle cx="18.5" cy="15" r="8" fill="#EB001B" />
    <circle cx="27.5" cy="15" r="8" fill="#F79E1B" />
    <path d="M23 8.4a8 8 0 010 13.2 8 8 0 010-13.2z" fill="#FF5F00" />
  </Card>
);
const Amex = () => (
  <Card label="American Express" bg="#006FCF" stroke="#006FCF">
    <text x="23" y="14" textAnchor="middle" fontFamily={F} fontSize="6.6" fontWeight="900" fill="#fff" letterSpacing=".3">AMERICAN</text>
    <text x="23" y="22" textAnchor="middle" fontFamily={F} fontSize="6.6" fontWeight="900" fill="#fff" letterSpacing=".5">EXPRESS</text>
  </Card>
);
const ApplePay = () => (
  <Card label="Apple Pay" stroke="#111">
    <g transform="translate(7.2 8.2) scale(.52)" fill="#000">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </g>
    <text x="20.5" y="20" fontFamily={F} fontSize="10.5" fontWeight="600" fill="#000">Pay</text>
  </Card>
);
const GooglePay = () => (
  <Card label="Google Pay">
    <g transform="translate(6 8.3) scale(.28)">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </g>
    <text x="21.5" y="19.8" fontFamily={F} fontSize="10.5" fontWeight="600" fill="#5F6368">Pay</text>
  </Card>
);
const PayPal = () => (
  <Card label="PayPal">
    <text x="23" y="19.6" textAnchor="middle" fontFamily={F} fontSize="11" fontWeight="900" fontStyle="italic">
      <tspan fill="#003087">Pay</tspan>
      <tspan fill="#009CDE">Pal</tspan>
    </text>
  </Card>
);
const Discover = () => (
  <Card label="Discover">
    <text x="4.6" y="18.3" fontFamily={F} fontSize="6.4" fontWeight="800" fill="#231F20" letterSpacing=".2">DISC</text>
    <circle cx="25.2" cy="16" r="3.6" fill="#F47216" />
    <text x="29.6" y="18.3" fontFamily={F} fontSize="6.4" fontWeight="800" fill="#231F20" letterSpacing=".2">VER</text>
    <path d="M45.5 21.5v4a4 4 0 01-4 4H18c12-1.2 21.5-4.1 27.5-8z" fill="#F47216" />
  </Card>
);
const Diners = () => (
  <Card label="Diners Club">
    <circle cx="23" cy="15" r="9" fill="#0079BE" />
    <circle cx="23" cy="15" r="7" fill="#fff" />
    <path d="M20.6 10.4a5 5 0 000 9.2zM25.4 10.4a5 5 0 010 9.2z" fill="#0079BE" />
  </Card>
);
const UnionPay = () => (
  <Card label="UnionPay">
    <path d="M12.5 6h9.5l-4 18H8.5a2 2 0 01-1.95-2.45l3.05-13.7A2.4 2.4 0 0112.5 6z" fill="#E21836" />
    <path d="M22 6h9l-4 18h-9z" fill="#00447C" />
    <path d="M31 6h6.5a2 2 0 011.95 2.45l-3.05 13.7A2.4 2.4 0 0133.5 24H27z" fill="#007B84" />
    <text x="23" y="17.6" textAnchor="middle" fontFamily={F} fontSize="5.6" fontWeight="800" fontStyle="italic" fill="#fff">UnionPay</text>
  </Card>
);

const ALL = {
  visa: Visa,
  mastercard: Mastercard,
  amex: Amex,
  applepay: ApplePay,
  googlepay: GooglePay,
  paypal: PayPal,
  discover: Discover,
  diners: Diners,
  unionpay: UnionPay,
};
export type PayBadge = keyof typeof ALL;

export const ALL_BADGES: PayBadge[] = ["visa", "mastercard", "amex", "applepay", "googlepay", "paypal", "discover", "diners", "unionpay"];

export function PayBadges({ list = ALL_BADGES, className = "" }: { list?: PayBadge[]; className?: string }) {
  return (
    <ul className={`kv-paybadges ${className}`.trim()} aria-label="Accepted payment methods">
      {list.map((key) => {
        const Badge = ALL[key];
        return (
          <li key={key}>
            <Badge />
          </li>
        );
      })}
    </ul>
  );
}

export type TrustIconName = "guarantee" | "truck" | "lock" | "shield" | "paw" | "battery";

/** The trust row's stroke icons. */
export function TrustIcon({ name }: { name: TrustIconName }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {name === "guarantee" && (<><path {...p} d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path {...p} d="M9 12l2.2 2.2L15.2 10" /></>)}
      {name === "truck" && (<><path {...p} d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle {...p} cx="7" cy="17.5" r="1.7" /><circle {...p} cx="17" cy="17.5" r="1.7" /></>)}
      {name === "lock" && (<><rect {...p} x="5" y="10" width="14" height="10" rx="2" /><path {...p} d="M8 10V7a4 4 0 018 0v3" /></>)}
      {name === "shield" && (<><path {...p} d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /></>)}
      {name === "paw" && (<><circle {...p} cx="6.6" cy="11" r="1.7" /><circle {...p} cx="9.9" cy="6.9" r="1.7" /><circle {...p} cx="14.1" cy="6.9" r="1.7" /><circle {...p} cx="17.4" cy="11" r="1.7" /><path {...p} d="M12 12.4c-2.5 0-4.5 1.9-4.5 4.1 0 1.5 1.2 2.4 2.6 2.4.8 0 1.200-.4 1.900-.4s1.100.4 1.900.4c1.400 0 2.600-.9 2.600-2.400 0-2.200-2-4.100-4.500-4.100z" /></>)}
      {name === "battery" && (<><rect {...p} x="3" y="8" width="15.5" height="9" rx="2" /><path {...p} d="M21 11v3M10.6 9.800L8.800 12.700h3.400L10.400 15.400" /></>)}
    </svg>
  );
}
