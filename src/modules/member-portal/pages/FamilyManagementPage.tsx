import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../auth/AuthContext";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";

interface FamilySummary {
  id: string;
  family_name: string;
  household_address: string | null;
  shared_contact_phone: string | null;
  isPrimaryLeader: boolean;
}

interface HouseholdMember {
  person_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  relationship_group: string;
  relationship_to_leader: string;
  relationship_description: string | null;
  is_primary_leader: boolean;
  has_login: boolean;
}

interface FamilyInvitation {
  invitation_id: string;
  invited_email: string;
  relationship_group: string;
  relationship_to_leader: string;
  relationship_description: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-white)",
  color: "var(--color-text-primary)",
  font: "inherit",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginBottom: "var(--space-3)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

const relationshipLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FamilyManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [family, setFamily] = useState<FamilySummary | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [rosterWarning, setRosterWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [relationshipGroup, setRelationshipGroup] = useState("immediate");
  const [relationship, setRelationship] = useState("son");
  const [relationshipDescription, setRelationshipDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRelationshipGroup, setInviteRelationshipGroup] = useState("immediate");
  const [inviteRelationship, setInviteRelationship] = useState("son");
  const [inviteRelationshipDescription, setInviteRelationshipDescription] = useState("");
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [invitationWarning, setInvitationWarning] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  const loadFamily = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setRosterWarning(null);
    setInvitationWarning(null);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("person_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.person_id) {
      setFamily(null);
      setMembers([]);
      setError(profileError?.message ?? "Your person profile is not linked yet. Please contact a ChurchConnect administrator.");
      setLoading(false);
      return;
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("family_members")
      .select("family_id, is_primary_leader, status")
      .eq("person_id", profile.person_id)
      .eq("status", "active")
      .limit(2);

    if (membershipError) {
      setError(membershipError.message);
      setFamily(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    if (!membershipRows?.length) {
      setFamily(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    if (membershipRows.length > 1) {
      setError("More than one active household was found for your person record. Please contact an administrator before making changes.");
      setFamily(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const membership = membershipRows[0];
    const { data: familyRow, error: familyError } = await supabase
      .from("families")
      .select("id, family_name, household_address, shared_contact_phone")
      .eq("id", membership.family_id)
      .maybeSingle();

    if (familyError || !familyRow) {
      setError(familyError?.message ?? "Your household could not be loaded.");
      setFamily(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const isPrimaryLeader = membership.is_primary_leader === true;
    setFamily({ ...familyRow, isPrimaryLeader });
    setFamilyName(familyRow.family_name);
    setAddress(familyRow.household_address ?? "");
    setPhone(familyRow.shared_contact_phone ?? "");

    const { data: rosterRows, error: rosterError } = await supabase.rpc("list_my_household_members");
    if (rosterError) {
      // Keep the current leader-only managed-child view usable until the
      // accompanying reviewed database migration is manually applied.
      setRosterWarning("The enhanced household roster is awaiting its reviewed database update. Existing household details remain available.");
      if (isPrimaryLeader) {
        const { data: memberRows } = await supabase
          .from("family_members")
          .select("person_id, relationship_group, relationship_to_leader, relationship_description, is_primary_leader, status")
          .eq("family_id", membership.family_id)
          .eq("status", "active");
        const personIds = (memberRows ?? []).map((row) => row.person_id);
        const { data: peopleRows } = personIds.length
          ? await supabase.from("people").select("id, full_name, date_of_birth, auth_user_id").in("id", personIds)
          : { data: [] };
        setMembers((memberRows ?? []).map((row) => {
          const person = (peopleRows ?? []).find((item) => item.id === row.person_id);
          return {
            person_id: row.person_id,
            full_name: person?.full_name ?? null,
            date_of_birth: person?.date_of_birth ?? null,
            relationship_group: row.relationship_group,
            relationship_to_leader: row.relationship_to_leader,
            relationship_description: row.relationship_description,
            is_primary_leader: row.is_primary_leader,
            has_login: Boolean(person?.auth_user_id),
          };
        }));
      } else {
        setMembers([]);
      }
    } else {
      setMembers((rosterRows ?? []) as HouseholdMember[]);
    }

    if (isPrimaryLeader) {
      const { data: invitationRows, error: invitationError } = await supabase.rpc("list_my_family_invitations");
      if (invitationError) {
        setInvitationWarning("Invitation tools will be available after the reviewed family-invitation database update is applied.");
        setInvitations([]);
      } else {
        setInvitations((invitationRows ?? []) as FamilyInvitation[]);
      }
    } else {
      setInvitations([]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadFamily();
  }, [loadFamily]);

  const createFamily = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc("create_family_as_primary_leader", {
      p_family_name: familyName.trim(),
      p_household_address: address.trim() || null,
      p_shared_contact_phone: phone.trim() || null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setNotice("Your household has been created. You are its initial primary Family Leader.");
      setFamilyName("");
      setAddress("");
      setPhone("");
      await loadFamily();
    }
    setSaving(false);
  };

  const saveHouseholdDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!family) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc("update_my_household_details", {
      p_family_name: familyName.trim(),
      p_household_address: address.trim() || null,
      p_shared_contact_phone: phone.trim() || null,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setNotice("Household details updated and recorded in the family audit history.");
      setEditingDetails(false);
      await loadFamily();
    }
    setSaving(false);
  };

  const addChild = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!family) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc("add_managed_child", {
      p_family_id: family.id,
      p_full_name: childName.trim(),
      p_date_of_birth: childDob,
      p_relationship_group: relationshipGroup,
      p_relationship_to_leader: relationship,
      p_relationship_description: relationshipDescription.trim() || null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setNotice("Managed child record added. No login account was created. Guardian consent and safeguarding review remain separate.");
      setChildName("");
      setChildDob("");
      setRelationshipDescription("");
      await loadFamily();
    }
    setSaving(false);
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!family?.isPrimaryLeader) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    setInvitationUrl(null);
    const { data, error: rpcError } = await supabase.rpc("create_family_invitation", {
      p_invited_email: inviteEmail.trim().toLowerCase(),
      p_relationship_group: inviteRelationshipGroup,
      p_relationship_to_leader: inviteRelationship,
      p_relationship_description: inviteRelationshipDescription.trim() || null,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      const result = data as { token?: string; invited_email?: string; expires_at?: string } | null;
      if (!result?.token) {
        setError("The invitation was created, but ChurchConnect did not return a shareable invitation token. Please refresh the page and check the invitation list.");
      } else {
        const url = new URL("/family/invite", window.location.origin);
        url.searchParams.set("token", result.token);
        setInvitationUrl(url.toString());
        setNotice(`Invitation created for ${result.invited_email ?? inviteEmail}. Copy the link and send it to the invited person.`);
        setInviteEmail("");
        setInviteRelationshipDescription("");
        await loadFamily();
      }
    }
    setSaving(false);
  };

  const copyInvitationLink = async () => {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setNotice("Invitation link copied. Send it to the invited person using your preferred messaging or email app.");
    } catch {
      setError("Clipboard access was unavailable. Select and copy the invitation link manually.");
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("revoke_family_invitation", {
      p_invitation_id: invitationId,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setNotice("Invitation revoked. Its link can no longer be accepted.");
      await loadFamily();
    }
    setSaving(false);
  };

  const malaysiaDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const malaysiaDatePart = (type: string) =>
    malaysiaDateParts.find((part) => part.type === type)?.value ?? "";
  const [todayYear, todayMonth, todayDay] = [
    Number(malaysiaDatePart("year")),
    Number(malaysiaDatePart("month")),
    Number(malaysiaDatePart("day")),
  ];
  const maxDob = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;
  const earliestManagedChildDate = new Date(Date.UTC(todayYear - 12, todayMonth - 1, todayDay + 1));
  const minDob = earliestManagedChildDate.toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>Family Management</h1>
        <p style={{ color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
          Manage your household details and family records.
        </p>
      </div>

      {error && <div role="alert" style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-soft-sage)", color: "var(--color-text-primary)" }}>{error}</div>}
      {notice && <div role="status" style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-soft-sage)", color: "var(--color-text-primary)" }}>{notice}</div>}
      {rosterWarning && <div role="status" style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-soft-sage)", color: "var(--color-text-secondary)" }}>{rosterWarning}</div>}

      {loading ? (
        <Card><CardBody><p>Loading your household…</p></CardBody></Card>
      ) : !family ? (
        <Card>
          <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Create your household</h2></CardHeader>
          <CardBody>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
              You can appoint yourself as the initial primary Family Leader. This grants household-management permissions only; it does not establish legal guardian authority.
            </p>
            <form onSubmit={createFamily}>
              <label style={fieldStyle}>Family / household name
                <input style={inputStyle} value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={160} required />
              </label>
              <label style={fieldStyle}>Household address
                <textarea style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
              </label>
              <label style={fieldStyle}>Shared contact phone
                <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
              </label>
              <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create household and appoint me as Family Leader"}</Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>{family.family_name}</h2>
                <Badge variant={family.isPrimaryLeader ? "approved" : "neutral"}>{family.isPrimaryLeader ? "Primary Family Leader" : "Family Member"}</Badge>
              </div>
            </CardHeader>
            <CardBody>
              {editingDetails && family.isPrimaryLeader ? (
                <form onSubmit={saveHouseholdDetails}>
                  <label style={fieldStyle}>Family / household name
                    <input style={inputStyle} value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={160} required />
                  </label>
                  <label style={fieldStyle}>Household address
                    <textarea style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} rows={3} maxLength={500} />
                  </label>
                  <label style={fieldStyle}>Shared contact phone
                    <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save household details"}</Button>
                    <Button type="button" variant="secondary" disabled={saving} onClick={() => {
                      setFamilyName(family.family_name);
                      setAddress(family.household_address ?? "");
                      setPhone(family.shared_contact_phone ?? "");
                      setEditingDetails(false);
                    }}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <p><strong>Address:</strong> {family.household_address || "Not provided"}</p>
                  <p><strong>Shared contact:</strong> {family.shared_contact_phone || "Not provided"}</p>
                  {family.isPrimaryLeader && <Button type="button" variant="secondary" onClick={() => setEditingDetails(true)}>Edit household details</Button>}
                </>
              )}
              {!family.isPrimaryLeader && <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>Household details are managed by your primary Family Leader.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Household members</h2></CardHeader>
            <CardBody>
              {members.length === 0 ? (
                <p style={{ color: "var(--color-text-secondary)" }}>No household roster is available yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {members.map((person) => (
                    <div key={person.person_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{person.full_name || "Name not provided"}</strong>
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                          {relationshipLabel(person.relationship_to_leader)}
                          {person.relationship_description ? ` · ${person.relationship_description}` : ""}
                          {family.isPrimaryLeader && person.date_of_birth ? ` · DOB ${person.date_of_birth}` : ""}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                          {person.has_login ? "Individual account" : "Managed person record"}
                        </div>
                      </div>
                      <Badge variant={person.is_primary_leader ? "approved" : "neutral"}>{person.is_primary_leader ? "Family Leader" : "Member"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {family.isPrimaryLeader && (
            <Card>
              <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Invite a family member</h2></CardHeader>
              <CardBody>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                  Invite someone aged 12 or above using their own email and ChurchConnect account. The invitation expires after 14 days. They must verify their email and complete the required account and safeguarding approvals before joining. ChurchConnect does not send the email automatically; copy the secure link and share it yourself.
                </p>
                {invitationWarning && <div role="status" style={{ marginBottom: 12, color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>{invitationWarning}</div>}
                {!invitationWarning && (
                  <>
                <form onSubmit={(event) => void createInvitation(event)}>
                  <label style={fieldStyle}>Invitee email address
                    <input style={inputStyle} type="email" autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} maxLength={254} placeholder="family.member@example.com" required />
                  </label>
                  <label style={fieldStyle}>Relationship group
                    <select style={inputStyle} value={inviteRelationshipGroup} onChange={(event) => {
                      const group = event.target.value;
                      setInviteRelationshipGroup(group);
                      setInviteRelationship(group === "immediate" ? "son" : "grandson");
                    }}>
                      <option value="immediate">Immediate family</option>
                      <option value="extended">Extended family</option>
                    </select>
                  </label>
                  <label style={fieldStyle}>Relationship to Family Leader
                    <select style={inputStyle} value={inviteRelationship} onChange={(event) => setInviteRelationship(event.target.value)}>
                      {inviteRelationshipGroup === "immediate" ? (
                        <>
                          <option value="spouse">Spouse</option>
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="son">Son</option>
                          <option value="daughter">Daughter</option>
                        </>
                      ) : (
                        <>
                          <option value="grandfather">Grandfather</option>
                          <option value="grandmother">Grandmother</option>
                          <option value="grandson">Grandson</option>
                          <option value="granddaughter">Granddaughter</option>
                          <option value="brother">Brother</option>
                          <option value="sister">Sister</option>
                          <option value="uncle">Uncle</option>
                          <option value="aunt">Aunt</option>
                          <option value="nephew">Nephew</option>
                          <option value="niece">Niece</option>
                          <option value="cousin">Cousin</option>
                          <option value="guardian">Guardian</option>
                          <option value="ward">Ward</option>
                          <option value="other_relative">Other relative</option>
                          <option value="other_household_member">Other household member</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label style={fieldStyle}>Additional relationship description (optional)
                    <input style={inputStyle} value={inviteRelationshipDescription} onChange={(event) => setInviteRelationshipDescription(event.target.value)} maxLength={120} />
                  </label>
                  <Button type="submit" disabled={saving || !inviteEmail.trim()}>{saving ? "Creating invitation…" : "Create invitation link"}</Button>
                </form>
                {invitationUrl && (
                  <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)" }}>
                    <label style={fieldStyle}>Share this invitation link
                      <input style={inputStyle} value={invitationUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
                    </label>
                    <Button type="button" onClick={() => void copyInvitationLink()}>Copy invitation link</Button>
                  </div>
                )}
                {invitations.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: "var(--text-base)" }}>Recent invitations</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {invitations.map((invitation) => (
                        <div key={invitation.invitation_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <strong>{invitation.invited_email}</strong>
                            <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>
                              {relationshipLabel(invitation.relationship_to_leader)} · Expires {new Date(invitation.expires_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <Badge variant={invitation.status === "accepted" ? "approved" : "neutral"}>{invitation.status}</Badge>
                            {invitation.status === "pending" && (
                              <Button type="button" variant="secondary" disabled={saving} onClick={() => void revokeInvitation(invitation.invitation_id)}>Revoke</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                  </>
                )}
              </CardBody>
            </Card>
          )}

          {family.isPrimaryLeader && (
            <Card>
              <CardHeader><h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Add a managed child</h2></CardHeader>
              <CardBody>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                  For a child under 12 who does not have an individual login. This creates a person record only. It does not create an Auth account or record guardian consent.
                </p>
                <form onSubmit={addChild}>
                  <label style={fieldStyle}>Child's full name
                    <input style={inputStyle} value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={160} required />
                  </label>
                  <label style={fieldStyle}>Date of birth
                    <input style={inputStyle} type="date" value={childDob} min={minDob} max={maxDob} onChange={(e) => setChildDob(e.target.value)} required />
                  </label>
                  <label style={fieldStyle}>Relationship group
                    <select style={inputStyle} value={relationshipGroup} onChange={(e) => {
                      const group = e.target.value;
                      setRelationshipGroup(group);
                      setRelationship(group === "immediate" ? "son" : "grandson");
                    }}>
                      <option value="immediate">Immediate family</option>
                      <option value="extended">Extended family</option>
                    </select>
                  </label>
                  <label style={fieldStyle}>Relationship to Family Leader
                    <select style={inputStyle} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                      {relationshipGroup === "immediate" ? (
                        <><option value="son">Son</option><option value="daughter">Daughter</option></>
                      ) : (
                        <><option value="grandson">Grandson</option><option value="granddaughter">Granddaughter</option><option value="ward">Ward</option></>
                      )}
                    </select>
                  </label>
                  <label style={fieldStyle}>Additional relationship description (optional)
                    <input style={inputStyle} value={relationshipDescription} onChange={(e) => setRelationshipDescription(e.target.value)} maxLength={120} />
                  </label>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add managed child"}</Button>
                </form>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
