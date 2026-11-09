import React, { useEffect, useState } from "react";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../AuthContext";

export const AccountSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const { data, error: queryError } = await supabase.from("profiles")
        .select("secondary_email").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setSecondaryEmail(data?.secondary_email ?? "");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving) return;
    const value = secondaryEmail.trim().toLowerCase();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid secondary email address, or leave it blank to remove it.");
      return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_secondary_email", target_user_id: user.id, secondary_email: value || null },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice("Your secondary email has been saved. It is not verified and cannot be used for account recovery yet.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your secondary email.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div><h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>Account Settings</h1><p style={{ color: "var(--color-text-secondary)" }}>Manage your backup contact details.</p></div>
      {error && <Alert variant="danger" title="Unable to complete request">{error}</Alert>}
      {notice && <Alert variant="success" title="Saved">{notice}</Alert>}
      <Card>
        <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Secondary email</h2></CardHeader>
        <CardBody>
          <p style={{ marginTop: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Use an alternative address we can contact if you lose access to your primary login email. Your primary email remains your ChurchConnect login.</p>
          <form onSubmit={(event) => void save(event)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Input id="secondary-email" label="Backup email address" type="email" value={secondaryEmail} onChange={(event) => setSecondaryEmail(event.target.value)} disabled={loading || saving} autoComplete="email" />
            <Alert variant="info" title="Verification not available yet">You can save a backup contact address now. It will not be used for password recovery until email verification is implemented.</Alert>
            <div><Button type="submit" isLoading={saving} disabled={loading || saving}>Save secondary email</Button></div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
