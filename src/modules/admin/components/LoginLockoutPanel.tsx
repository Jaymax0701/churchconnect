import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";
import { supabase } from "../../../lib/supabase";

interface ActiveLoginLockout {
  user_id: string;
  email: string | null;
  full_name: string | null;
  active_network_blocks: number;
  highest_failed_attempts: number;
  latest_locked_until: string;
  latest_failed_at: string | null;
}

export const LoginLockoutPanel: React.FC = () => {
  const [lockouts, setLockouts] = useState<ActiveLoginLockout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadLockouts = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "list_active_churchconnect_login_lockouts",
    );

    if (rpcError) {
      setError(rpcError.message);
      setLockouts([]);
    } else {
      setLockouts((data ?? []) as ActiveLoginLockout[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadLockouts();
  }, [loadLockouts]);

  const handleUnlock = async (account: ActiveLoginLockout) => {
    if (unlockingUserId) return;
    const confirmed = window.confirm(
      `Unlock the email + IP login block(s) for ${account.full_name || account.email || "this account"}? The shared IP-wide protection will remain active. This action will be recorded in the security audit log.`,
    );
    if (!confirmed) return;

    setUnlockingUserId(account.user_id);
    setError(null);
    setNotice(null);

    const { data, error: unlockError } = await supabase.rpc(
      "admin_unlock_churchconnect_login_lockout",
      { p_target_user_id: account.user_id },
    );

    if (unlockError) {
      setError(unlockError.message);
    } else {
      const result = Array.isArray(data) ? data[0] : null;
      setNotice(
        `Login block cleared. ${Number(result?.removed_bucket_count ?? 0)} email + IP bucket(s) and ${Number(result?.removed_failed_attempts ?? 0)} failed attempt(s) were cleared. Shared IP-wide protection was not changed.`,
      );
      await loadLockouts(true);
    }

    setUnlockingUserId(null);
  };

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));

  return (
    <Card>
      <CardHeader>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
          <div>
            <h3 style={{ fontSize: "var(--text-lg)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon name="lock" size={20} /> Account Login Security
            </h3>
            <p style={{ fontSize: "var(--text-xs)", margin: "2px 0 0", color: "var(--color-text-secondary)" }}>
              Active email + IP login blocks. This is not a global account suspension.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Badge variant={lockouts.length > 0 ? "pending" : "neutral"}>{lockouts.length} active</Badge>
            <Button variant="secondary" size="sm" onClick={() => void loadLockouts(true)} disabled={loading || refreshing || Boolean(unlockingUserId)}>
              <Icon name="refresh" size={16} /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody style={{ padding: 0 }}>
        {error && <div style={{ padding: "var(--space-4)" }}><Alert variant="danger" title="Unable to load or update login security">{error}</Alert></div>}
        {notice && <div style={{ padding: "var(--space-4)" }}><Alert variant="success" title="Security action recorded">{notice}</Alert></div>}
        {loading ? (
          <div role="status" style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-secondary)" }}>Loading active login blocks…</div>
        ) : lockouts.length === 0 ? (
          <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
            <Icon name="shield_check" size={28} color="var(--color-success-text)" />
            <h4 style={{ margin: "var(--space-2) 0" }}>No active account login blocks</h4>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
              No active email + IP lockouts are currently associated with registered accounts.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--color-ivory-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                  <th scope="col" style={{ padding: "var(--space-3) var(--space-6)" }}>Account</th>
                  <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Failed attempts</th>
                  <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Active network blocks</th>
                  <th scope="col" style={{ padding: "var(--space-3) var(--space-4)" }}>Latest expiry</th>
                  <th scope="col" style={{ padding: "var(--space-3) var(--space-6)", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lockouts.map((account) => (
                  <tr key={account.user_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <td style={{ padding: "var(--space-4) var(--space-6)", minWidth: 220 }}>
                      <div style={{ fontWeight: 600 }}>{account.full_name || "Name not provided"}</div>
                      <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>{account.email || "Email unavailable"}</div>
                      <div style={{ marginTop: "6px" }}><Badge variant="pending">Login blocked · email + IP</Badge></div>
                    </td>
                    <td style={{ padding: "var(--space-4)", whiteSpace: "nowrap" }}>{account.highest_failed_attempts}</td>
                    <td style={{ padding: "var(--space-4)", whiteSpace: "nowrap" }}>{account.active_network_blocks}</td>
                    <td style={{ padding: "var(--space-4)", minWidth: 180, whiteSpace: "nowrap" }}>{formatDateTime(account.latest_locked_until)}</td>
                    <td style={{ padding: "var(--space-4) var(--space-6)", textAlign: "right" }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={Boolean(unlockingUserId)}
                        isLoading={unlockingUserId === account.user_id}
                        onClick={() => void handleUnlock(account)}
                      >
                        <Icon name="lock_open" size={15} /> Unlock
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
  );
};
