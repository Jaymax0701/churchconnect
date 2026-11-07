import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export type CongregationMembershipStatus = "pending" | "active" | "inactive";

export interface CongregationMembership {
  status: CongregationMembershipStatus;
  member_since: string | null;
}

export function useCongregationMembership(userId: string | null) {
  const [membership, setMembership] = useState<CongregationMembership | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMembership() {
      if (!userId) {
        setMembership(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setMembership(null);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("congregation_memberships")
        .select("status, member_since")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      if (queryError) {
        setMembership(null);
        setError(queryError.message);
      } else {
        setMembership(data as CongregationMembership | null);
        setError(null);
      }

      setLoading(false);
    }

    void loadMembership();

    return () => {
      active = false;
    };
  }, [userId]);

  return { membership, loading, error };
}
