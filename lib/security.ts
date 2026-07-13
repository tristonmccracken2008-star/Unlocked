import crypto from "node:crypto";

const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const rateLimitMemory = new Map<string, { count: number; expiresAt: number }>();
const rateLimitScript = "local current=redis.call('INCR',KEYS[1]); if current == 1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return current";

export class SecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

export function requiredAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || Buffer.byteLength(secret, "utf8") < 32)) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes in production.");
  }
  return secret ?? "unlocked-development-secret";
}

export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }
  if (url.username || url.password) throw new Error("NEXT_PUBLIC_APP_URL must not contain credentials.");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.");
  return url.origin;
}

export function constantTimeEqual(left: string | undefined | null, right: string | undefined | null) {
  if (!left || !right) return false;
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest) && left.length === right.length;
}

function requestOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") throw new SecurityError("Cross-site request rejected.", 403, "cross_site_request");

  const expected = appOrigin();
  const origin = requestOrigin(request.headers.get("origin"));
  const referer = requestOrigin(request.headers.get("referer"));
  if (origin && origin !== expected) throw new SecurityError("Request origin rejected.", 403, "invalid_origin");
  if (!origin && referer && referer !== expected) throw new SecurityError("Request origin rejected.", 403, "invalid_origin");
  if (!origin && !referer && process.env.NODE_ENV === "production") {
    throw new SecurityError("Request origin could not be verified.", 403, "missing_origin");
  }
}

function contentLength(request: Request) {
  const header = request.headers.get("content-length");
  if (!header) return null;
  const parsed = Number(header);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function readBoundedText(request: Request, maxBytes: number) {
  const declared = contentLength(request);
  if (declared !== null && declared > maxBytes) throw new SecurityError("Request body is too large.", 413, "body_too_large");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new SecurityError("Request body is too large.", 413, "body_too_large");
  return text;
}

export async function readBoundedJson<T = unknown>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) throw new SecurityError("JSON content type required.", 415, "unsupported_media_type");
  const text = await readBoundedText(request, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SecurityError("Invalid JSON body.", 400, "invalid_json");
  }
}

export async function readBoundedForm(request: Request, maxBytes = 8 * 1024) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    throw new SecurityError("Form content type required.", 415, "unsupported_media_type");
  }
  return new URLSearchParams(await readBoundedText(request, maxBytes));
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, 120);
}

function rateLimitKey(scope: string, identity: string) {
  const secret = process.env.RATE_LIMIT_SECRET ?? requiredAuthSecret();
  const digest = crypto.createHmac("sha256", secret).update(`${scope}:${identity}`).digest("hex");
  return `unlocked:rate:${scope}:${digest.slice(0, 32)}`;
}

async function incrementRateLimit(key: string, windowSeconds: number) {
  if (!kvUrl || !kvToken) {
    const now = Date.now();
    const current = rateLimitMemory.get(key);
    if (!current || current.expiresAt <= now) {
      rateLimitMemory.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(kvUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", rateLimitScript, "1", key, String(windowSeconds)]),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Rate limit store failed: ${response.status}`);
    const body = await response.json() as { result?: number | string };
    const count = Number(body.result);
    if (!Number.isFinite(count)) throw new Error("Rate limit store returned an invalid count.");
    return count;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
  subject?: string,
) {
  const identity = subject ? `subject:${subject}` : `address:${clientAddress(request)}`;
  let count: number;
  try {
    count = await incrementRateLimit(rateLimitKey(scope, identity), windowSeconds);
  } catch (error) {
    console.error("[UnlockED security] Rate limit check failed", {
      scope,
      errorCategory: error instanceof Error ? error.name : "unknown",
    });
    if (process.env.NODE_ENV === "production") throw new SecurityError("Request protection is temporarily unavailable.", 503, "rate_limit_unavailable");
    return;
  }
  if (count > limit) throw new SecurityError("Too many requests.", 429, "rate_limited", windowSeconds);
}

export function securityErrorResponse(error: unknown, fallback = "Request could not be completed.") {
  if (error instanceof SecurityError) {
    const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
    if (error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers });
  }
  return Response.json({ error: fallback }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export function safeLogText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.replace(/[\r\n\t\0]/g, " ").slice(0, maxLength) : undefined;
}

export function validatedRedirectUrl(value: string | null | undefined, allowedHosts: string[]) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}
