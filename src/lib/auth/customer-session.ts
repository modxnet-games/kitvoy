import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface CustomerSession {
  userId: string;
  email: string;
  fullName: string;
  loginAt: number;
}

const MIN_SECRET_LENGTH = 32;
const FALLBACK_SECRET = "dev-customer-session-min-32-chars!!!!!";

const rawSecret = process.env.SESSION_SECRET?.trim() ?? "";
const SESSION_SECRET =
  rawSecret.length >= MIN_SECRET_LENGTH ? rawSecret : FALLBACK_SECRET;

/** Only set secure cookies when the app is served over HTTPS */
const isHttps = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");

const SESSION_OPTIONS = {
  password: SESSION_SECRET,
  cookieName: "kitvoy_customer_session",
  cookieOptions: {
    secure: isHttps,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax" as const,
  },
};

export async function getCustomerSession() {
  const cookieStore = await cookies();
  return getIronSession<Partial<CustomerSession>>(
    cookieStore,
    SESSION_OPTIONS
  );
}

export async function getCustomer(): Promise<CustomerSession | null> {
  const session = await getCustomerSession();
  if (
    !session.userId ||
    !session.email ||
    !session.fullName ||
    typeof session.loginAt !== "number"
  ) {
    return null;
  }
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  if (Date.now() - session.loginAt > maxAge * 1000) {
    await clearCustomerSession();
    return null;
  }
  return {
    userId: session.userId,
    email: session.email,
    fullName: session.fullName,
    loginAt: session.loginAt,
  };
}

export async function isCustomerAuthenticated(): Promise<boolean> {
  return (await getCustomer()) !== null;
}

export async function clearCustomerSession() {
  const session = await getCustomerSession();
  session.userId = undefined;
  session.email = undefined;
  session.fullName = undefined;
  session.loginAt = undefined;
  await session.save();
}
