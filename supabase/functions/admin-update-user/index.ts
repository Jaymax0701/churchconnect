import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "The account-management function is not configured." }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Your session is invalid or expired." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("is_approved")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Unable to verify administrator approval." }, 500);

  const { data: callerRoles, error: roleError } = await adminClient
    .from("user_roles")
    .select("role_id, scope_type, ministry_id")
    .eq("user_id", callerData.user.id)
    .eq("role_id", "superadmin")
    .eq("scope_type", "global")
    .is("ministry_id", null);
  if (roleError) return json({ error: "Unable to verify administrator permissions." }, 500);

  if (callerProfile?.is_approved !== true || !callerRoles?.length) {
    return json({ error: "Only an approved global Superadmin can edit user accounts." }, 403);
  }

  let payload: { target_user_id?: string; full_name?: string; email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const targetUserId = payload.target_user_id?.trim();
  const fullName = payload.full_name?.trim();
  const email = payload.email?.trim().toLowerCase();

  if (!targetUserId || !fullName || fullName.length > 120 || !email || email.length > 254) {
    return json({ error: "A valid target user, full name and email are required." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (targetError || !targetData.user) return json({ error: "Target account was not found." }, 404);

  const target = targetData.user;
  const oldName = typeof target.user_metadata?.full_name === "string" ? target.user_metadata.full_name : "";
  const oldEmail = target.email ?? "";

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", targetUserId);
  if (profileUpdateError) return json({ error: "Unable to update the profile name: " + profileUpdateError.message }, 500);

  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    email,
    user_metadata: { ...target.user_metadata, full_name: fullName },
  });

  if (authUpdateError) {
    await adminClient.from("profiles").update({ full_name: oldName }).eq("id", targetUserId);
    return json({ error: "Auth update failed; the profile name change was rolled back. " + authUpdateError.message }, 400);
  }

  return json({
    success: true,
    email_changed: email !== oldEmail,
    email_confirmation_required: email !== oldEmail,
    message: email !== oldEmail
      ? "The name was updated. Supabase has been asked to process the email change; the new address may require confirmation."
      : "The account name was updated.",
  });
});
