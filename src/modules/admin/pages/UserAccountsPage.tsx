import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
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
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

export const UserAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("list_user_accounts");
      if (rpcError) {
        setError(rpcError.message);
        setAccounts([]);
      } else {
        setAccounts((data ?? []) as UserAccount[]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "An unexpected error occurred.");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);


  const beginEdit = (account: UserAccount) => {
    setEditingAccount(account);
    setEditFullName(account.full_name ?? "");
    setEditEmail(account.email ?? "");
    setError(null);
    setNotice(null);
  };

  const saveAccount = async () => {
    if (!editingAccount || updatingAccount) return;
    setUpdatingAccount(true);
    setError(null);
    setNotice(null);
    const { data, error: updateError } = await supabase.functions.invoke("admin-update-user", {
      body: { target_user_id: editingAccount.user_id, full_name: editFullName.trim(), email: editEmail.trim() },
    });
    setUpdatingAccount(false);
    if (updateError || data?.error) {
      setError(data?.error || updateError?.message || "Unable to update this account.");
      return;
    }
    setNotice(data?.message || "Account updated.");
    setEditingAccount(null);
    await loadAccounts();
  };

  const sendPasswordReset = async (account: UserAccount) => {
    if (!account.email || resettingUserId) return;
    if (!window.confirm("Send a password reset email to " + account.email + "?")) return;
    setResettingUserId(account.user_id);
    setError(null);
    setNotice(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(account.email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setResettingUserId(null);
    if (resetError) setError(resetError.message);
    else setNotice("Password reset email requested for " + account.email + ".");
  };

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesSearch = !query || [
        account.full_name,
        account.email,
        account.role_assignments,
        account.membership_status,
      ].some((value) => value?.toLowerCase().includes(query));

      const matchesApproval =
        approvalFilter === "all" ||
        (approvalFilter === "approved" && account.is_approved) ||
        (approvalFilter === "pending" && !account.is_approved);

      return matchesSearch && matchesApproval;
    });
  }, [accounts, searchTerm, approvalFilter]);

  const approvedCount = accounts.filter((account) => account.is_approved).length;
  const pendingCount = accounts.length - approvedCount;
  const activeMemberCount = accounts.filter((account) => account.membership_status === "active").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>User Accounts</h2>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)" }}>
            View registered accounts, approval status, role assignments and congregation membership.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadAccounts()} disabled={loading}>
          <Icon name="refresh" size={16} /> Refresh
        </Button>
      </div>

      {notice && <Alert variant="success" title="Account action completed">{notice}</Alert>}

      {error && (
        <Alert variant="danger" title="Unable to load user accounts">
          {error}
          {error.includes("list_user_accounts")
            ? " Apply the reviewed user-account directory SQL in the development/staging Supabase project."
            : ""}
        </Alert>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        {[
          { label: "Total accounts", value: accounts.length, icon: "group" },
          { label: "Approved", value: approvedCount, icon: "verified_user" },
          { label: "Pending approval", value: pendingCount, icon: "pending" },
          { label: "Active members", value: activeMemberCount, icon: "groups" },
        ].map((item) => (
          <Card key={item.label}>
            <CardBody style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <div>
                <p style={{ fontSize: "var(--text-xs)", margin: 0 }}>{item.label}</p>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {loading ? "—" : item.value}
                </div>
              </div>
              <Icon name={item.icon} size={26} color="var(--color-forest-green)" />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Registered Accounts</h3>
              <p style={{ fontSize: "var(--text-xs)", margin: "2px 0 0" }}>
                Read-only directory. Account approval, membership and role assignment remain separate processes.
              </p>
            </div>
            <Badge>{filteredAccounts.length} shown</Badge>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border-default)" }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, email, role or membership…"
              aria-label="Search user accounts"
              style={{ width: "100%", maxWidth: "420px", minHeight: "40px", padding: "0 var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--color-white)" }}
            />
            <select
              value={approvalFilter}
              onChange={(event) => setApprovalFilter(event.target.value)}
              aria-label="Filter by approval status"
              style={{ minHeight: "40px", padding: "0 var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--color-white)" }}
            >
              <option value="all">All approval statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending approval</option>
            </select>
          </div>

          {loading ? (
            <div role="status" style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>
              Loading user accounts…
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
              <Icon name="group_off" size={30} color="var(--color-text-muted)" />
              <h4 style={{ margin: "var(--space-2) 0" }}>{accounts.length === 0 ? "No accounts found" : "No matching accounts"}</h4>
              <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                {accounts.length === 0 ? "There are no registered accounts to display." : "Try another search term or approval filter."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-ivory-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-6)" }}>Account</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Approval</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Role assignment</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Membership</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Registered</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-6)", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.user_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "var(--space-4) var(--space-6)", minWidth: "220px" }}>
                        <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{account.full_name || "Name not provided"}</div>
                        <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>{account.email || "Email unavailable"}</div>
                      </td>
                      <td style={{ padding: "var(--space-4)" }}>
                        <Badge variant={account.is_approved ? "approved" : "pending"}>{account.is_approved ? "Approved" : "Pending"}</Badge>
                      </td>
                      <td style={{ padding: "var(--space-4)", minWidth: "180px", color: "var(--color-text-secondary)" }}>
                        {account.role_assignments || "No role assigned"}
                      </td>
                      <td style={{ padding: "var(--space-4)", minWidth: "140px" }}>
                        <div>{account.membership_status || "Not assigned"}</div>
                        {account.member_since && <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>Since {formatDate(account.member_since)}</div>}
                      </td>
                      <td style={{ padding: "var(--space-4)", whiteSpace: "nowrap" }}>{formatDate(account.registered_at)}</td>
                      <td style={{ padding: "var(--space-3) var(--space-6)", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                          <Button size="sm" variant="secondary" onClick={() => beginEdit(account)}>Edit</Button>
                          <Button size="sm" variant="ghost" disabled={!account.email || Boolean(resettingUserId)} isLoading={resettingUserId === account.user_id} onClick={() => void sendPasswordReset(account)}>Reset password</Button>
                        </div>
                      </td>
                    </tr>
                    {editingAccount?.user_id === account.user_id && (
                      <tr>
                        <td colSpan={6} style={{ padding: "var(--space-4) var(--space-6)", background: "var(--color-ivory-subtle)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)", alignItems: "end" }}>
                            <Input id={"edit-name-" + account.user_id} label="Full name" value={editFullName} onChange={(event) => setEditFullName(event.target.value)} required maxLength={120} />
                            <Input id={"edit-email-" + account.user_id} label="Email address" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required />
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                              <Button size="sm" onClick={() => void saveAccount()} isLoading={updatingAccount} disabled={updatingAccount || !editFullName.trim() || !editEmail.trim()}>Save changes</Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditingAccount(null)} disabled={updatingAccount}>Cancel</Button>
                            </div>
                          </div>
                          <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>Email changes may require confirmation through the new email address. Password reset sends a secure link; administrators never see or set the user's password.</p>
                        </td>
                      </tr>
                    )}
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Alert variant="info" title="Read-only administration">
        Account editing is limited to name and email. Password reset sends a secure email link. Approval, congregation membership and role assignments remain separate workflows.
      </Alert>
    </div>
  );
};
