import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";
import { supabase } from "../../../lib/supabase";

interface PendingAccount {
  user_id: string;
  email: string | null;
  full_name: string | null;
  registered_at: string;
}

export const AdminDashboardPage: React.FC = () => {
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadPendingAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("list_pending_accounts");

    if (rpcError) {
      setError(rpcError.message);
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as PendingAccount[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPendingAccounts();
  }, [loadPendingAccounts]);

  const handleApprove = async (account: PendingAccount) => {
    if (!account.user_id || approvingUserId) return;

    const confirmed = window.confirm(
      `Approve ${account.full_name || account.email || "this account"}? This will allow the account to pass the account-approval gate.`,
    );
    if (!confirmed) return;

    setApprovingUserId(account.user_id);
    setError(null);
    setNotice(null);

    const { error: approvalError } = await supabase.rpc("approve_account", {
      target_user_id: account.user_id,
    });

    if (approvalError) {
      setError(approvalError.message);
    } else {
      setNotice(`${account.full_name || account.email || "Account"} has been approved.`);
      setAccounts((current) => current.filter((item) => item.user_id !== account.user_id));
    }

    setApprovingUserId(null);
  };

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) =>
      [account.full_name, account.email]
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [accounts, searchTerm]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
            Church Administration
          </h2>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)" }}>
            Review verified registrations and manage account access.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadPendingAccounts()} disabled={loading || Boolean(approvingUserId)}>
          <Icon name="refresh" size={16} /> Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Unable to load or update account approvals">
          {error}
          {error.includes("list_pending_accounts") || error.includes("approve_account")
            ? " The reviewed account-approval SQL may not have been applied yet."
            : ""}
        </Alert>
      )}

      {notice && (
        <Alert variant="success" title="Account updated">
          {notice}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="user-check" size={20} color="var(--color-forest-green)" />
                Pending Account Approvals
              </h3>
              <p style={{ fontSize: "var(--text-xs)", margin: "2px 0 0", color: "var(--color-text-secondary)" }}>
                Only email-verified accounts awaiting administrator approval are shown.
              </p>
            </div>
            <Badge variant="pending">{accounts.length} pending</Badge>
          </div>
        </CardHeader>

        <CardBody style={{ padding: 0 }}>
          <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border-default)" }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search pending accounts"
              style={{
                width: "100%",
                maxWidth: "360px",
                height: "38px",
                padding: "0 var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--color-white)",
              }}
            />
          </div>

          {loading ? (
            <div role="status" style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>
              Loading pending accounts…
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
              <Icon name="check-circle" size={28} color="var(--color-success-text)" />
              <h4 style={{ margin: "var(--space-2) 0" }}>
                {accounts.length === 0 ? "No pending approvals" : "No matching accounts"}
              </h4>
              <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                {accounts.length === 0
                  ? "There are currently no email-verified registrations waiting for approval."
                  : "Try another name or email address."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-ivory-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-6)" }}>Name</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Email</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Registered</th>
                    <th scope="col" style={{ padding: "var(--space-3) var(--space-6)", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.user_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "var(--space-4) var(--space-6)", fontWeight: 600 }}>
                        {account.full_name || "Name not provided"}
                      </td>
                      <td style={{ padding: "var(--space-4) var(--space-4)", color: "var(--color-text-secondary)" }}>
                        {account.email || "Email unavailable"}
                      </td>
                      <td style={{ padding: "var(--space-4) var(--space-4)", whiteSpace: "nowrap" }}>
                        {formatDate(account.registered_at)}
                      </td>
                      <td style={{ padding: "var(--space-4) var(--space-6)", textAlign: "right" }}>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={Boolean(approvingUserId)}
                          isLoading={approvingUserId === account.user_id}
                          onClick={() => void handleApprove(account)}
                        >
                          <Icon name="check" size={15} /> Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Alert variant="info" title="Approval is separate from membership and role assignment">
        Approving an account updates its approval status only. It does not automatically activate congregation membership or assign a role.
      </Alert>
    </div>
  );
};
