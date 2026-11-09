import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../AuthContext";

interface ConsentRecord {
  consent_type: string;
  policy_version: string;
  consented: boolean;
  notice_language: string;
  captured_at: string;
}

export const AccountSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const [profileResult, consentResult] = await Promise.all([
        supabase.from("profiles").select("secondary_email,date_of_birth").eq("id", user.id).maybeSingle(),
        supabase.from("privacy_consent_records")
          .select("consent_type,policy_version,consented,notice_language,captured_at")
          .eq("user_id", user.id)
          .order("captured_at", { ascending: false }),
      ]);
      if (!active) return;
      if (profileResult.error) setError(profileResult.error.message);
      else {
        setSecondaryEmail(profileResult.data?.secondary_email ?? "");
        setDateOfBirth(profileResult.data?.date_of_birth ?? null);
      }
      if (consentResult.error) {
        setError((current) => current ?? consentResult.error.message);
      } else {
        setConsentRecords((consentResult.data ?? []) as ConsentRecord[]);
      }
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
      <div><h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>Account Settings</h1><p style={{ color: "var(--color-text-secondary)" }}>Manage your account and privacy information.</p></div>
      {error && <Alert variant="danger" title="Unable to complete request">{error}</Alert>}
      {notice && <Alert variant="success" title="Saved">{notice}</Alert>}

      <Card>
        <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Personal information</h2></CardHeader>
        <CardBody>
          <p style={{ marginTop: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Date of birth recorded during registration.</p>
          <p style={{ fontWeight: 600 }}>{loading ? "Loading…" : dateOfBirth ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(new Date(dateOfBirth + "T00:00:00")) : "Not recorded"}</p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>If this date is incorrect, contact the ChurchConnect privacy representative to request a correction. Self-service date-of-birth editing is not enabled.</p>
        </CardBody>
      </Card>

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

      <Card>
        <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Privacy and consent history</h2></CardHeader>
        <CardBody>
          <p style={{ marginTop: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>These records show the Privacy Notice version and choices recorded when you registered.</p>
          <p><Link to="/privacy" style={{ color: "var(--color-forest-green)", fontWeight: 700 }}>Read the ChurchConnect Privacy Notice</Link></p>
          {loading ? <p>Loading consent history…</p> : consentRecords.length === 0 ? <p style={{ fontSize: "var(--text-sm)" }}>No consent records were found for this account. Contact the privacy representative if you believe this is incorrect.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", textAlign: "left" }}>
                <thead><tr><th style={{ padding: "8px" }}>Choice</th><th style={{ padding: "8px" }}>Status</th><th style={{ padding: "8px" }}>Notice</th><th style={{ padding: "8px" }}>Recorded</th></tr></thead>
                <tbody>{consentRecords.map((record, index) => (
                  <tr key={`${record.consent_type}-${record.policy_version}-${index}`} style={{ borderTop: "1px solid var(--border-default)" }}>
                    <td style={{ padding: "8px" }}>{record.consent_type === "privacy_processing" ? "Privacy processing" : "Optional marketing"}</td>
                    <td style={{ padding: "8px" }}>{record.consented ? "Accepted" : "Declined"}</td>
                    <td style={{ padding: "8px" }}>{record.policy_version} ({record.notice_language.toUpperCase()})</td>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.captured_at))}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Alert variant="info" title="Privacy requests">To request access, correction, withdrawal of consent or raise a privacy concern, contact [CHURCH PRIVACY CONTACT — TO BE CONFIGURED].</Alert>
        </CardBody>
      </Card>
    </div>
  );
};
