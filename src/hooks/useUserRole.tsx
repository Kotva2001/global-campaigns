import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  clearAuthRedirectFromUrl,
  getAuthRedirectInfo,
  isForbiddenAuthError,
  logAuthStartupConfig,
} from "@/lib/authRedirect";

export type AppRole = "admin" | "editor" | "viewer";

type Ctx = {
  user: User | null;
  role: AppRole | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserRoleContext = createContext<Ctx>({
  user: null,
  role: null,
  displayName: null,
  avatarUrl: null,
  email: null,
  loading: true,
  refresh: async () => {},
});

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = async (u: User | null) => {
    if (!u) {
      setUser(null);
      setRole(null);
      setDisplayName(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Claim row by email if not yet linked + update last_login
      const { data: claimed, error: claimError } = await supabase.rpc("claim_user_role" as never);
      if (claimError) throw claimError;

      let row = (claimed as { role?: AppRole; display_name?: string | null } | null) ?? null;
      if (!row) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, display_name")
          .eq("user_id", u.id)
          .maybeSingle();
        if (error) throw error;
        row = data as typeof row;
      }
      setRole((row?.role as AppRole) ?? null);
      setDisplayName(
        (row?.display_name as string | null) ??
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      );
    } catch (error) {
      console.error("[Auth] Failed to load user role", error);
      if (isForbiddenAuthError(error)) {
        await supabase.auth.signOut();
        clearAuthRedirectFromUrl();
        setUser(null);
      }
      setRole(null);
      setDisplayName(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    logAuthStartupConfig();

    // Set up listener BEFORE checking session, so we catch the SIGNED_IN
    // event triggered when supabase parses the OAuth hash fragment.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      void loadRole(u);

      if (event === "SIGNED_IN") {
        clearAuthRedirectFromUrl();
        // Redirect to dashboard if currently on root or login.
        const path = window.location.pathname;
        if (path === "/" || path === "" || path === "/login") {
          window.history.replaceState({}, document.title, "/dashboard");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }
    });

    const detectSession = async () => {
      const redirectInfo = getAuthRedirectInfo();
      console.info("[Auth] detectSession start", {
        hash: window.location.hash,
        search: window.location.search,
        redirectInfo,
      });
      try {
        let { data, error } = await supabase.auth.getSession();
        console.info("[Auth] getSession result", { data, error });

        let u = data?.session?.user ?? null;

        // Fallback: manually extract tokens from hash if getSession didn't pick them up
        if (!u && redirectInfo.hasHashAccessToken) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");
          console.info("[Auth] Attempting manual setSession from hash", {
            hasAccessToken: Boolean(access_token),
            hasRefreshToken: Boolean(refresh_token),
          });
          if (access_token && refresh_token) {
            const manual = await supabase.auth.setSession({ access_token, refresh_token });
            console.info("[Auth] Manual setSession result", manual);
            if (!manual.error) {
              u = manual.data.session?.user ?? null;
              error = null;
            } else {
              error = manual.error;
            }
          }
        }

        if (error) throw error;

        if (redirectInfo.hasAuthParams && !u) {
          console.warn("[Auth] OAuth redirect params were present but no valid session was restored; clearing stale auth URL.");
          await supabase.auth.signOut();
          clearAuthRedirectFromUrl();
          await loadRole(null);
          return;
        }

        if (redirectInfo.hasAuthParams) clearAuthRedirectFromUrl();
        setUser(u);
        await loadRole(u);
      } catch (error) {
        console.error("[Auth] Session detection failed", error);
        if (redirectInfo.hasAuthParams || isForbiddenAuthError(error)) {
          await supabase.auth.signOut();
          clearAuthRedirectFromUrl();
        }
        await loadRole(null);
      }
    };

    void detectSession();

    return () => sub.subscription.unsubscribe();
  }, []);

  // Reflect role on <html> for global CSS gating
  useEffect(() => {
    const root = document.documentElement;
    if (role) root.dataset.role = role;
    else delete root.dataset.role;
  }, [role]);

  const value: Ctx = {
    user,
    role,
    displayName,
    avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
    email: user?.email ?? null,
    loading,
    refresh: async () => loadRole(user),
  };

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
};

export const useUserRole = () => useContext(UserRoleContext);
export const useCanEdit = () => {
  const { role } = useUserRole();
  return role === "admin" || role === "editor";
};
export const useIsAdmin = () => useUserRole().role === "admin";

/** Renders children only if the current user can edit (admin/editor). */
export const CanEdit = ({ children }: { children: ReactNode }) => {
  const can = useCanEdit();
  return can ? <>{children}</> : null;
};

/** Renders children only for admins. */
export const AdminOnly = ({ children }: { children: ReactNode }) => {
  const isAdmin = useIsAdmin();
  return isAdmin ? <>{children}</> : null;
};