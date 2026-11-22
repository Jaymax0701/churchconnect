import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let authSecretKey: string | null = null;

try {
  const secretKeys = JSON.parse(secretKeysRaw ?? "{}") as Record<string, string>;
  authSecretKey = secretKeys.default ?? null;
} catch {
  throw new Error("Supabase default secret API key is not configured.");
}
const hmacSecret = Deno.env.get("LOGIN_RATE_LIMIT_SECRET");
const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://churchconnect-alpha.vercel.app";

if (!supabaseUrl || !serviceRoleKey || !authSecretKey || !hmacSecret || hmacSecret.length < 32) {
  throw new Error("Secure login environment is not configured.");
}

const allowedOrigins = new Set([
  appOrigin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(Deno.env.get("ADDITIONAL_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const corsHeaders = (origin: string | null): Record<string, string> => ({
  ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Content-Type": "application/json",
});

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  headers: HeadersInit,
) => Response.json(body, { status, headers });

const encoder = new TextEncoder();

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(hmacSecret!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getTrustedClientIp(req: Request): string | null {
  // Supabase's gateway/Cloudflare supplies these headers. Do not trust a
  // caller-provided X-Forwarded-For value as the primary source.
  const candidate = (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    ""
  ).trim();

  if (!candidate || candidate.length > 45 || candidate.includes(",") || /\s/.test(candidate)) {
    return null;
  }

  const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate)
    && candidate.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  const isIpv6 = candidate.includes(":") && /^[0-9a-f:]+$/i.test(candidate);

  return isIpv4 || isIpv6 ? candidate.toLowerCase() : null;
}

async function readJsonBody(req: Request): Promise<unknown> {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 8192) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  if (!req.body) throw new Error("INVALID_BODY");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 8192) {
        await reader.cancel();
        throw new Error("REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse({ error: "Origin not allowed." }, 403, headers);
    }
    return new Response("ok", { status: 200, headers });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, headers);
  }

  // CORS is not authentication, but reject browser origins that are not
  // explicitly configured. Non-browser clients may omit Origin.
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403, headers);
  }

  const clientIp = getTrustedClientIp(req);
  if (!clientIp) {
    return jsonResponse({ error: "Unable to process this sign-in request." }, 400, headers);
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "REQUEST_TOO_LARGE" ? 413 : 400;
    return jsonResponse({ error: "Invalid sign-in request." }, status, headers);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid sign-in request." }, 400, headers);
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.email !== "string" ||
    typeof input.password !== "string" ||
    typeof input.captchaToken !== "string" ||
    input.captchaToken.length < 1 ||
    input.captchaToken.length > 4096 ||
    input.email.length > 254 ||
    input.password.length < 1 ||
    input.password.length > 1024
  ) {
    return jsonResponse({ error: "Complete the security check and enter your email and password." }, 400, headers);
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const captchaToken = input.captchaToken;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address and password." }, 400, headers);
  }

  const emailIpKey = await hmacHex("email-ip:" + email + ":" + clientIp);
  const ipKey = await hmacHex("ip:" + clientIp);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Supabase requires a new-format secret API key with Sb-Forwarded-For
  // for Auth rate limiting to use the real visitor IP behind this proxy.
  const authClient = createClient(supabaseUrl, authSecretKey, {
    global: { headers: { "Sb-Forwarded-For": clientIp } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: lockoutRows, error: lockoutError } = await adminClient.rpc(
    "check_login_lockout",
    { p_email_ip_key: emailIpKey, p_ip_key: ipKey },
  );

  if (lockoutError) {
    return jsonResponse({ error: "Sign-in is temporarily unavailable. Please try again." }, 503, headers);
  }

  const lockout = Array.isArray(lockoutRows) ? lockoutRows[0] : null;
  if (lockout?.is_locked) {
    const minutes = Math.max(1, Math.ceil(Number(lockout.retry_after_seconds || 60) / 60));
    return jsonResponse({
      error: "Too many unsuccessful attempts. Please try again in about " + minutes + " minute(s).",
      retry_after_seconds: Number(lockout.retry_after_seconds || 0),
    }, 429, {
      ...headers,
      "Retry-After": String(Math.max(1, Number(lockout.retry_after_seconds || 60))),
    });
  }

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (authError || !authData.session) {
    // CAPTCHA failures are not credential failures and must not increase
    // the application's failed-password counters.
    const authErrorCode = authError?.code?.toLowerCase() ?? "";
    const authErrorMessage = authError?.message.toLowerCase() ?? "";
    if (authErrorCode === "captcha_failed" || authErrorMessage.includes("captcha")) {
      return jsonResponse({
        error: "Security verification failed or expired. Please complete the check again.",
      }, 400, headers);
    }

    // Upstream Auth throttling or server failures are not counted as an
    // incorrect password attempt in this application's own counter.
    if (authError?.status === 429) {
      return jsonResponse({ error: "Sign-in is temporarily rate-limited. Please wait and try again." }, 429, headers);
    }
    if (authError?.status && authError.status >= 500) {
      return jsonResponse({ error: "Sign-in is temporarily unavailable. Please try again." }, 503, headers);
    }

    const { error: recordError } = await adminClient.rpc(
      "record_login_failure_with_account",
      {
        p_email_ip_key: emailIpKey,
        p_ip_key: ipKey,
        p_email: email,
      },
    );

    if (recordError) {
      return jsonResponse({ error: "Sign-in is temporarily unavailable. Please try again." }, 503, headers);
    }

    const { data: updatedRows, error: updatedLockoutError } = await adminClient.rpc(
      "check_login_lockout",
      { p_email_ip_key: emailIpKey, p_ip_key: ipKey },
    );

    if (!updatedLockoutError && Array.isArray(updatedRows) && updatedRows[0]?.is_locked) {
      const seconds = Math.max(1, Number(updatedRows[0].retry_after_seconds || 60));
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      return jsonResponse({
        error: "Too many unsuccessful attempts. Please try again in about " + minutes + " minute(s).",
        retry_after_seconds: seconds,
      }, 429, { ...headers, "Retry-After": String(seconds) });
    }

    // Same message for unknown email, incorrect password, and unverified email.
    return jsonResponse({
      error: "Unable to sign in. Check your credentials and email verification, then try again.",
    }, 401, headers);
  }

  // A successful password sign-in clears only this email/IP pair. The
  // shared IP bucket remains to limit password spraying across accounts.
  await adminClient.rpc(
    "clear_login_failures",
    { p_email_ip_key: emailIpKey },
  );

  return jsonResponse({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  }, 200, headers);
});
