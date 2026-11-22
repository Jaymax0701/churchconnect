import { createClient } from "@supabase/supabase-js";

const PASSWORD_RECOVERY_MARKER = "churchconnect:password-recovery-pending";

// Supabase may consume the PKCE callback and clean the URL before the reset
// route mounts. Capture the callback before creating the client so the route
// can still verify the resulting recovery session.
if (typeof window !== "undefined") {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const isRecoveryCallback =
    searchParams.has("code") || hashParams.get("type") === "recovery";

  if (isRecoveryCallback) {
    try {
      window.sessionStorage.setItem(PASSWORD_RECOVERY_MARKER, "true");
    } catch {
      // The URL callback check in the reset page remains as a fallback.
    }
  }
}

export function consumePasswordRecoveryMarker(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const isPending = window.sessionStorage.getItem(PASSWORD_RECOVERY_MARKER) === "true";
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_MARKER);
    return isPending;
  } catch {
    return false;
  }
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
