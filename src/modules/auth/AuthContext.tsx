import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  is_approved: boolean;
  approved_at: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const currentUser = session?.user;
    if (!currentUser) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, is_approved, approved_at")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileError(error.message);
    } else {
      setProfile(data);
      setProfileError(null);
    }

    setProfileLoading(false);
  }, [session?.user]);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setProfileError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, is_approved, approved_at")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setProfile(null);
        setProfileError(error.message);
      } else {
        setProfile(data);
        setProfileError(null);
      }
      setProfileLoading(false);
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading: authLoading || (Boolean(session?.user) && profileLoading),
      profileError,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, authLoading, profileLoading, profileError, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
