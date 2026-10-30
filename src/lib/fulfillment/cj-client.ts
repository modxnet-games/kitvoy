/**
 * Minimal CJdropshipping API 2.0 client.
 * Docs: https://developers.cjdropshipping.com/en/api/api2/api/shopping.html
 */
const BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

/** Base accounts are limited to one request per second. */
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 20_000;

/** CJ error codes this app reacts to. */
export const CJ_CODES = {
  INVALID_TOKEN: 1600001,
  TOO_MANY_REQUESTS: 1600200,
  ORDER_EXISTS: 1603003,
  ORDER_NOT_FOUND: 1603100,
  BALANCE_INSUFFICIENT: 1604000,
} as const;

export class CjError extends Error {
  constructor(public code: number, message: string) {
    super(`CJ ${code}: ${message}`);
    this.name = "CjError";
  }
}

interface Envelope<T> {
  code: number;
  result: boolean;
  message: string;
  data: T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let token: { value: string; expiresAt: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

/** Runs CJ calls one at a time, spaced to stay under the rate limit. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

async function send<T>(method: string, path: string, body: unknown, accessToken?: string): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { "CJ-Access-Token": accessToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json) throw new CjError(res.status, `HTTP ${res.status} with no JSON body`);
  if (json.code !== 200 || json.result === false) throw new CjError(json.code, json.message);
  return json.data;
}

/** The token lasts 180 days and CJ returns the same one for 24h, so one per process is plenty. */
async function getAccessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const apiKey = process.env.CJ_API_KEY?.trim();
  if (!apiKey) throw new CjError(0, "CJ_API_KEY is not set");
  const data = await send<{ accessToken: string; accessTokenExpiryDate: string }>(
    "POST",
    "/authentication/getAccessToken",
    { apiKey },
  );
  const expiresAt = Date.parse(data.accessTokenExpiryDate);
  token = { value: data.accessToken, expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 86_400_000 };
  // The token call counts toward the rate limit too
  await sleep(MIN_INTERVAL_MS);
  return token.value;
}

/** Calls an authenticated CJ endpoint, renewing the token once if CJ rejects it. */
export function cjRequest<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  return throttled(async () => {
    try {
      return await send<T>(method, path, body, await getAccessToken());
    } catch (err) {
      if (!(err instanceof CjError) || err.code !== CJ_CODES.INVALID_TOKEN) throw err;
      token = null;
      await sleep(MIN_INTERVAL_MS);
      return send<T>(method, path, body, await getAccessToken());
    }
  });
}

/** CJ order fields this app reads from the detail endpoint. */
export interface CjOrderDetail {
  orderId: string;
  orderNum?: string;
  orderStatus?: string;
  trackNumber?: string | null;
  logisticName?: string | null;
}

/** Looks an order up by CJ order id or by our own order number. */
export function getCjOrder(orderId: string): Promise<CjOrderDetail | null> {
  return cjRequest<CjOrderDetail | null>(
    "GET",
    `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`,
  ).catch((err) => {
    if (err instanceof CjError && err.code === CJ_CODES.ORDER_NOT_FOUND) return null;
    throw err;
  });
}

export async function getCjBalance(): Promise<number> {
  const data = await cjRequest<{ amount: number } | null>("GET", "/shopping/pay/getBalance");
  return Number(data?.amount ?? 0);
}

/** Confirms a created order, then pays it from the CJ balance. */
export async function payCjOrder(orderId: string): Promise<void> {
  await cjRequest("PATCH", "/shopping/order/confirmOrder", { orderId }).catch((err) => {
    // An order that's already confirmed can't be confirmed again; the payment
    // below reports any real problem
    if (!(err instanceof CjError)) throw err;
  });
  await cjRequest("POST", "/shopping/pay/payBalance", { orderId });
}

/** A short, admin-readable reason for a failed CJ call. */
export function describeCjError(err: unknown): string {
  if (err instanceof CjError) {
    if (err.code === CJ_CODES.BALANCE_INSUFFICIENT) return "CJ balance is too low to pay this order";
    if (err.code === CJ_CODES.TOO_MANY_REQUESTS) return "CJ rate limit hit, try again in a minute";
    return err.message;
  }
  if (err instanceof Error && err.name === "TimeoutError") return "CJ didn't respond in time";
  return err instanceof Error ? err.message : String(err);
}
