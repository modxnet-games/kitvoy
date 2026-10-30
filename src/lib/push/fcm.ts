import jwt from "jsonwebtoken";

/**
 * Firebase Cloud Messaging HTTP v1 sender for the Kitvoy admin app.
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_BASE64, the base64 of the Firebase
 * Admin SDK service-account JSON (Project settings → Service accounts).
 */

/** Android channel the app creates; its sound is res/raw/notification */
export const SALES_CHANNEL_ID = "kitvoy_sales";
export const SALES_SOUND = "notification";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let account: ServiceAccount | null | undefined;
let accessToken: { value: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  account = null;
  if (!raw) return account;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as ServiceAccount;
    if (parsed.project_id && parsed.client_email && parsed.private_key) account = parsed;
    else console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_BASE64 is missing project_id, client_email or private_key");
  } catch {
    console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_BASE64 isn't base64-encoded service-account JSON");
  }
  return account;
}

export function isFcmConfigured(): boolean {
  return getServiceAccount() !== null;
}

/** OAuth2 access token for FCM, from a self-signed service-account JWT; cached until near expiry. */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" },
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!res.ok || !json?.access_token) throw new Error(`Google OAuth ${res.status}: ${json?.error_description ?? "no access token"}`);
  accessToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return accessToken.value;
}

export interface SalePush {
  title: string;
  body: string;
  /** String values only (FCM data payload) */
  data: Record<string, string>;
}

/**
 * The FCM v1 message: a high-priority notification on the kitvoy_sales channel
 * with the custom sound, so Android shows and rings it while the app is closed
 * or the phone is locked; on iOS the bundled notification.wav plays.
 */
export function buildSaleMessage(token: string, push: SalePush) {
  return {
    message: {
      token,
      notification: { title: push.title, body: push.body },
      data: push.data,
      android: {
        priority: "HIGH",
        ttl: "86400s",
        notification: {
          channel_id: SALES_CHANNEL_ID,
          sound: SALES_SOUND,
          notification_priority: "PRIORITY_MAX",
          visibility: "PUBLIC",
          default_vibrate_timings: true,
          tag: push.data.orderId || undefined,
        },
      },
      apns: {
        headers: { "apns-priority": "10", "apns-push-type": "alert" },
        payload: { aps: { sound: `${SALES_SOUND}.wav`, "interruption-level": "time-sensitive" } },
      },
    },
  };
}

export type FcmSendResult = { token: string; ok: true } | { token: string; ok: false; error: string; unregistered: boolean };

/** Sends one push per token. Never throws; reports which tokens FCM no longer accepts. */
export async function sendSalePush(tokens: string[], push: SalePush): Promise<FcmSendResult[]> {
  const sa = getServiceAccount();
  if (!sa) return tokens.map((token) => ({ token, ok: false, error: "FCM is not configured", unregistered: false }));

  let bearer: string;
  try {
    bearer = await getAccessToken(sa);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return tokens.map((token) => ({ token, ok: false, error, unregistered: false }));
  }

  return Promise.all(
    tokens.map(async (token): Promise<FcmSendResult> => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildSaleMessage(token, push)),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return { token, ok: true };
        const json = (await res.json().catch(() => null)) as {
          error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
        } | null;
        const code = json?.error?.details?.find((d) => d.errorCode)?.errorCode ?? json?.error?.status ?? String(res.status);
        // The app was uninstalled or the token rotated
        const unregistered = code === "UNREGISTERED" || (res.status === 400 && /registration token/i.test(json?.error?.message ?? ""));
        return { token, ok: false, error: `${code}: ${json?.error?.message ?? res.statusText}`, unregistered };
      } catch (err) {
        return { token, ok: false, error: err instanceof Error ? err.message : String(err), unregistered: false };
      }
    }),
  );
}
