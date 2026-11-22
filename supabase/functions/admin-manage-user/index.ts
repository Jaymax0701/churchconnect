import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://churchconnect-alpha.vercel.app";
const turnstileSecretKey = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";

const getCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (origin === appOrigin || origin.startsWith("http://localhost:")) ? origin : appOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

 
async function verifyTurnstile(token: string, remoteIp: string | null) {
  if (!turnstileSecretKey) {
    return { success: false, error: "Turnstile is not configured on the server." };
  }
  const formData = new FormData();
  formData.set("secret", turnstileSecretKey);
  formData.set("response", token);
  if (remoteIp) formData.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) return { success: false, error: "Unable to verify the security check." };
    const result = await response.json() as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    const expectedHostname = new URL(appOrigin).hostname;
    const hostnameAllowed = result.hostname === expectedHostname ||
      (expectedHostname === "localhost" && result.hostname === "localhost");
    if (!result.success || result.action !== "admin_password_reset" || !hostnameAllowed) {
      return { success: false, error: "Security check failed. Please complete it again." };
    }
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Unable to verify the security check." };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  if (origin && origin !== appOrigin && !origin.startsWith("http://localhost:")) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers: corsHeaders });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
  }

  const token = authorization.slice("Bearer ".length);
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  const actor = callerData.user;
  if (callerError || !actor) return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders });

  const { data: actorProfile, error: profileError } = await adminClient
    .from("profiles").select("is_approved").eq("id", actor.id).maybeSingle();

  let body: { action?: string; target_user_id?: string; full_name?: string; email?: string; secondary_email?: string | null; captcha_token?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders });
  }

  const targetId = body.target_user_id;
  if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
    return Response.json({ error: "A valid target user ID is required." }, { status: 400, headers: corsHeaders });
  }
  if (profileError || actorProfile?.is_approved !== true) {
    return Response.json({ error: "An approved account is required." }, { status: 403, headers: corsHeaders });
  }

  const isSelfSecondaryUpdate = body.action === "update_secondary_email" && targetId === actor.id;
  if (!isSelfSecondaryUpdate) {
    if (targetId === actor.id) {
      return Response.json({ error: "Use the secondary email setting for your own account." }, { status: 400, headers: corsHeaders });
    }
    const { data: actorRoles, error: roleError } = await adminClient
      .from("user_roles").select("id").eq("user_id", actor.id).eq("role_id", "superadmin")
      .eq("scope_type", "global").is("ministry_id", null).limit(1);
    if (roleError || !actorRoles?.length) {
      return Response.json({ error: "Only an approved global Superadmin can manage other accounts." }, { status: 403, headers: corsHeaders });
    }
  }

  if (body.action === "send_password_reset") {
    const captchaToken = body.captcha_token?.trim();
    if (!captchaToken) {
      return Response.json({ error: "Complete the security check before sending a password-reset email." }, { status: 400, headers: corsHeaders });
    }
    const captcha = await verifyTurnstile(captchaToken, req.headers.get("cf-connecting-ip"));
    if (!captcha.success) {
      return Response.json({ error: captcha.error ?? "Security check failed." }, { status: 403, headers: corsHeaders });
    }
  }

  let auditAction = "";
  let auditDetails: Record<string, unknown> = {};
  let actionWarning: string | null = null;

  if (body.action === "update_secondary_email") {
    const secondaryEmail = body.secondary_email?.trim().toLowerCase() || null;
    if (secondaryEmail && (secondaryEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondaryEmail))) {
      return Response.json({ error: "Provide a valid secondary email address." }, { status: 400, headers: corsHeaders });
    }
    const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(targetId);
    if (targetAuthError || !targetAuth.user) return Response.json({ error: "Target account not found." }, { status: 404, headers: corsHeaders });
    if (secondaryEmail && targetAuth.user.email?.toLowerCase() === secondaryEmail) {
      return Response.json({ error: "Secondary email must be different from the primary login email." }, { status: 400, headers: corsHeaders });
    }
    const { error: secondaryError } = await adminClient.from("profiles").update({
      secondary_email: secondaryEmail,
      secondary_email_verified_at: null,
    }).eq("id", targetId);
    if (secondaryError) return Response.json({ error: secondaryError.message }, { status: 500, headers: corsHeaders });
    auditAction = "update_secondary_email";
    auditDetails = { secondary_email_set: Boolean(secondaryEmail), verification_reset: true };
  } else if (body.action === "update_account") {
    const fullName = body.full_name?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!fullName || fullName.length > 160 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Provide a valid full name and email address." }, { status: 400, headers: corsHeaders });
    }

    const { data: existingUser, error: existingError } = await adminClient.auth.admin.getUserById(targetId);
    if (existingError || !existingUser.user) return Response.json({ error: "Target account not found." }, { status: 404, headers: corsHeaders });

    const emailChanged = existingUser.user.email?.toLowerCase() !== email;
    if (emailChanged) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetId, { email, email_confirm: false });
      if (authUpdateError) return Response.json({ error: authUpdateError.message }, { status: 400, headers: corsHeaders });
    }

    const { error: nameError } = await adminClient.rpc("admin_update_person_name", {
      actor_user_id: actor.id,
      target_user_id: targetId,
      new_full_name: fullName,
    });
    if (nameError) return Response.json({ error: nameError.message }, { status: 500, headers: corsHeaders });

    const { error: metadataError } = await adminClient.auth.admin.updateUserById(targetId, {
      user_metadata: { ...existingUser.user.user_metadata, full_name: fullName },
    });
    if (metadataError) {
      actionWarning = "The profile name was updated, but Auth display metadata could not be synchronized.";
    }
    auditAction = "update_account";
    auditDetails = { name_updated: true, primary_email_changed: emailChanged };
  } else if (body.action === "send_password_reset") {
    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(targetId);
    if (targetError || !targetUser.user?.email) return Response.json({ error: "Target account or email not found." }, { status: 404, headers: corsHeaders });
    const { error: resetError } = await callerClient.auth.resetPasswordForEmail(targetUser.user.email, {
      redirectTo: `${appOrigin}/reset-password`,
      captchaToken: body.captcha_token,
    });
    if (resetError) return Response.json({ error: resetError.message }, { status: 400, headers: corsHeaders });
    auditAction = "send_password_reset";
    auditDetails = { email_sent: true };
  } else {
    return Response.json({ error: "Unsupported account action." }, { status: 400, headers: corsHeaders });
  }

  const { error: auditError } = await adminClient.from("admin_account_audit").insert({
    actor_user_id: actor.id, target_user_id: targetId, action: auditAction, details: auditDetails,
  });
  if (auditError) {
    return Response.json({
      success: true,
      warning: [actionWarning, "The account action succeeded, but the audit event could not be saved. Notify the system administrator."]
        .filter(Boolean).join(" "),
    }, { headers: corsHeaders });
  }

  return Response.json(actionWarning ? { success: true, warning: actionWarning } : { success: true }, { headers: corsHeaders });
});
