import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "viewer";

type Ctx = {
  user: User | null;
  role: AppRole | null;
  isOwner: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserRoleContext = createContext<Ctx>({
  user: null,
  role: null,
  isOwner: false,
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
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRole = async (u: User | null) => {
    if (!u) {
      setUser(null);
      setRole(null);
      setDisplayName(null);
      setIsOwner(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Claim row by email if not yet linked + update last_login
      const { data: claimed, error: claimError } = await supabase.rpc("claim_user_role" as never);
      if (claimError) throw claimError;

      let row = (claimed as { role?: AppRole; display_name?: string | null; is_owner?: boolean } | null) ?? null;
      if (!row) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, display_name, is_owner")
          .eq("user_id", u.id)
          .maybeSingle();
        if (error) throw error;
        row = data as typeof row;
      }
      setRole((row?.role as AppRole) ?? null);
      setIsOwner(Boolean(row?.is_owner));
      setDisplayName(
        (row?.display_name as string | null) ??
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      );
    } catch (error) {
      console.error("[Auth] Failed to load user role", error);
      setRole(null);
      setDisplayName(null);
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      void loadRole(u);

      if (event === "SIGNED_IN") {
        const path = window.location.pathname;
        if (path === "/" || path === "" || path === "/login") {
          window.history.replaceState({}, document.title, "/dashboard");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      setUser(u);
      await loadRole(u);
    })();

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
    isOwner,
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
export const useIsOwner = () => useUserRole().isOwner;

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

/** Renders children only for the single super-admin owner. */
export const OwnerOnly = ({ children }: { children: ReactNode }) => {
  const isOwner = useIsOwner();
  return isOwner ? <>{children}</> : null;
};