import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface AdminSession {
  isAdmin: true;
  username: string;
  loginAt: number;
}

const MIN_PASSWORD_LENGTH = 32;
const FALLBACK_SECRET = "dev-fallback-min-32-characters-long!!!";

const rawSecret = process.env.SESSION_SECRET?.trim() ?? "";
const SESSION_SECRET =
  rawSecret.length >= MIN_PASSWORD_LENGTH ? rawSecret : FALLBACK_SECRET;

/** Only set secure cookies when the app is served over HTTPS */
const isHttps = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");

const SESSION_OPTIONS = {
  password: SESSION_SECRET,
  cookieName: "kitvoy_admin_session",
  cookieOptions: {
    secure: isHttps,
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
    sameSite: "lax" as const,
  },
};

export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<Partial<AdminSession>>(cookieStore, SESSION_OPTIONS);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  if (!session.isAdmin || !session.username) return false;
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const loginAt = session.loginAt ?? 0;
  if (Date.now() - loginAt > maxAge * 1000) {
    session.isAdmin = undefined;
    session.username = undefined;
    session.loginAt = undefined;
    await session.save();
    return false;
  }
  return true;
}

/**
 * The first line of every admin server action.
 *
 * A server action is a public POST endpoint: anyone can call it directly,
 * whatever page its form is on. The dashboard layout's redirect protects the
 * pages, not the actions, so each action checks the session itself. Without a
 * valid one the caller is sent to the sign-in page and the action's body never
 * runs (redirect throws). Call it before any `try`, so nothing catches it.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}
