import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://churchconnect-alpha.vercel.app";

const getCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (origin === appOrigin || origin.startsWith("http://localhost:")) ? origin : appOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

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

  let body: { action?: string; target_user_id?: string; full_name?: string; email?: string; secondary_email?: string | null };
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

  let auditAction = "";
  let auditDetails: Record<string, unknown> = {};

  if (body.action === "update_secondary_email") {
    const secondaryEmail = body.secondary_email?.trim().toLowerCase() || null;
    if (secondaryEmail && (secondaryEmail.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(secondaryEmail))) {
      return Response.json({ error: "Provide a valid secondary email address." }, { status: 400, headers: corsHeaders });
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

    const { error: nameError } = await adminClient.from("profiles").update({ full_name: fullName }).eq("id", targetId);
    if (nameError) return Response.json({ error: nameError.message }, { status: 500, headers: corsHeaders });

    await adminClient.auth.admin.updateUserById(targetId, { user_metadata: { ...existingUser.user.user_metadata, full_name: fullName } });
    auditAction = "update_account";
    auditDetails = { name_updated: true, primary_email_changed: emailChanged };
  } else if (body.action === "send_password_reset") {
    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(targetId);
    if (targetError || !targetUser.user?.email) return Response.json({ error: "Target account or email not found." }, { status: 404, headers: corsHeaders });
    const { error: resetError } = await callerClient.auth.resetPasswordForEmail(targetUser.user.email, {
      redirectTo: `${appOrigin}/reset-password`,
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
      warning: "The account action succeeded, but the audit event could not be saved. Notify the system administrator.",
    }, { headers: corsHeaders });
  }

  return Response.json({ success: true }, { headers: corsHeaders });
});
