import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabase";

interface UserAccount {
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_approved: boolean;
  approved_at: string | null;
  registered_at: string;
  role_assignments: string | null;
  membership_status: string | null;
  member_since: string | null;
}

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
};

export const UserAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("list_user_accounts");
      if (rpcError) throw rpcError;
      setAccounts((data ?? []) as UserAccount[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load user accounts.");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesSearch = !query || [account.full_name, account.email, account.role_assignments, account.membership_status]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesApproval = approvalFilter === "all" ||
        (approvalFilter === "approved" && account.is_approved) ||
        (approvalFilter === "pending" && !account.is_approved);
      return matchesSearch && matchesApproval;
    });
  }, [accounts, searchTerm, approvalFilter]);

  const approvedCount = accounts.filter((account) => account.is_approved).length;
  const pendingCount = accounts.length - approvedCount;
  const activeMemberCount = accounts.filter((account) => account.membership_status === "active").length;

  const openEditor = (account: UserAccount) => {
    setEditing(account);
    setEditName(account.full_name ?? "");
    setEditEmail(account.email ?? "");
    setError(null);
    setNotice(null);
  };

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || saving) return;
    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_account", target_user_id: editing.user_id, full_name: name, email },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice((email !== editing.email
        ? "Name updated. An email-change confirmation has been sent to the new address; the address changes after confirmation."
        : "Account name updated successfully.") + (data?.warning ? ` ${data.warning}` : ""));
      setEditing(null);
      await loadAccounts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update this account.");
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async (account: UserAccount) => {
    if (!account.email || resettingUserId) return;
    if (!window.confirm(`Send a password-reset email to ${account.email}?`)) return;
    setResettingUserId(account.user_id);
    setError(null);
    setNotice(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "send_password_reset", target_user_id: account.user_id },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice(`Password-reset email sent to ${account.email}.` + (data?.warning ? ` ${data.warning}` : ""));
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to send the password-reset email.");
    } finally {
      setResettingUserId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>User Accounts</h2>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)" }}>
            Review registered accounts and manage basic account details.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadAccounts()} disabled={loading}>
          <Icon name="refresh" size={16} /> Refresh
        </Button>
      </div>

      {error && <Alert variant="danger" title="Account operation unsuccessful">{error}</Alert>}
      {notice && <Alert variant="success" title="Account updated">{notice}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        {[
          { label: "Total accounts", value: accounts.length, icon: "group" },
          { label: "Approved", value: approvedCount, icon: "verified_user" },
          { label: "Pending approval", value: pendingCount, icon: "pending" },
          { label: "Active members", value: activeMemberCount, icon: "groups" },
        ].map((item) => (
          <Card key={item.label}><CardBody style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <div><p style={{ fontSize: "var(--text-xs)", margin: 0 }}>{item.label}</p><div style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>{loading ? "—" : item.value}</div></div>
            <Icon name={item.icon} size={26} color="var(--color-forest-green)" />
          </CardBody></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <div><h3 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Registered Accounts</h3>
              <p style={{ fontSize: "var(--text-xs)", margin: "2px 0 0" }}>Account changes are restricted to approved global Superadmins and audited.</p></div>
            <Badge>{filteredAccounts.length} shown</Badge>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border-default)" }}>
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, email, role or membership…" aria-label="Search user accounts"
              style={{ width: "100%", maxWidth: "420px", minHeight: "40px", padding: "0 var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--color-white)" }} />
            <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} aria-label="Filter by approval status"
              style={{ minHeight: "40px", padding: "0 var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--color-white)" }}>
              <option value="all">All approval statuses</option><option value="approved">Approved</option><option value="pending">Pending approval</option>
            </select>
          </div>
          {loading ? <div role="status" style={{ padding: "var(--space-8)", textAlign: "center" }}>Loading user accounts…</div> :
            filteredAccounts.length === 0 ? <div style={{ padding: "var(--space-8)", textAlign: "center" }}><Icon name="group_off" size={30} /><h4>{accounts.length === 0 ? "No accounts found" : "No matching accounts"}</h4></div> :
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
              <thead><tr style={{ backgroundColor: "var(--color-ivory-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                <th style={{ padding: "var(--space-3) var(--space-6)" }}>Account</th><th style={{ padding: "var(--space-3) var(--space-4)" }}>Approval</th>
                <th style={{ padding: "var(--space-3) var(--space-4)" }}>Role</th><th style={{ padding: "var(--space-3) var(--space-4)" }}>Membership</th>
                <th style={{ padding: "var(--space-3) var(--space-4)" }}>Registered</th><th style={{ padding: "var(--space-3) var(--space-6)", textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{filteredAccounts.map((account) => <tr key={account.user_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                <td style={{ padding: "var(--space-4) var(--space-6)", minWidth: "220px" }}>
                  <div style={{ fontWeight: 600 }}>{account.full_name || "Name not provided"}</div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>{account.email || "Email unavailable"}</div>
                </td>
                <td style={{ padding: "var(--space-4)" }}><Badge variant={account.is_approved ? "approved" : "pending"}>{account.is_approved ? "Approved" : "Pending"}</Badge></td>
                <td style={{ padding: "var(--space-4)", minWidth: "150px" }}>{account.role_assignments || "No role assigned"}</td>
                <td style={{ padding: "var(--space-4)", minWidth: "130px" }}>{account.membership_status || "Not assigned"}{account.member_since && <div style={{ fontSize: "var(--text-xs)" }}>Since {formatDate(account.member_since)}</div>}</td>
                <td style={{ padding: "var(--space-4)", whiteSpace: "nowrap" }}>{formatDate(account.registered_at)}</td>
                <td style={{ padding: "var(--space-4) var(--space-6)" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", minWidth: "190px" }}>
                    <Button size="sm" variant="secondary" onClick={() => openEditor(account)}><Icon name="edit" size={14} /> Edit</Button>
                    <Button size="sm" variant="ghost" disabled={!account.email || Boolean(resettingUserId)}
                      isLoading={resettingUserId === account.user_id} onClick={() => void sendPasswordReset(account)}>
                      <Icon name="lock_reset" size={14} /> Reset
                    </Button>
                  </div>
                </td>
              </tr>)}</tbody>
            </table></div>}
        </CardBody>
      </Card>

      {editing && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}
        style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: "var(--space-4)" }}>
        <Card><CardBody style={{ width: "min(440px, calc(100vw - 48px))", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div><h3 style={{ margin: 0 }}>Edit account</h3><p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>Changes apply to this user's profile and authentication email.</p></div>
          <form onSubmit={(event) => void saveAccount(event)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Input id="account-name" label="Full name" value={editName} onChange={(event) => setEditName(event.target.value)} required autoComplete="name" />
            <Input id="account-email" label="Email address" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required autoComplete="email" />
            {editEmail.trim().toLowerCase() !== (editing.email ?? "").toLowerCase() &&
              <Alert variant="info" title="Email confirmation required">Supabase will send a confirmation link to the new email address. The existing email remains until the change is confirmed.</Alert>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" isLoading={saving} disabled={saving}><Icon name="save" size={15} /> Save changes</Button>
            </div>
          </form>
        </CardBody></Card>
      </div>}

      <Alert variant="info" title="Role and membership remain separate">Editing an account does not approve it, assign a role, or activate congregation membership.</Alert>
    </div>
  );
};
