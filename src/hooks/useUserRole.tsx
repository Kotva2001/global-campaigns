import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "viewer";

const INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24h
const LAST_ACTIVITY_KEY = "auth:lastActivity";

export const clearAllSessionStorage = () => {
  try {
    // Clear supabase-related and app keys; leave nothing behind.
    const keep: string[] = [];
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !keep.includes(k)) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
};

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
  const currentSessionRef = useRef<Session | null>(null);
  const roleLoadedForUserRef = useRef<string | null>(null);

  const loadRole = async (u: User | null) => {
    if (!u) {
      roleLoadedForUserRef.current = null;
      setUser(null);
      setRole(null);
      setDisplayName(null);
      setIsOwner(false);
      setLoading(false);
      return;
    }
    // A valid auth session must unlock the app immediately. Role lookup is a
    // separate, fail-closed step and must never be responsible for setting the
    // authenticated user after an OAuth callback.
    setUser(u);
    // Only show the loading skeleton on the very first load. Subsequent
    // refreshes (e.g. TOKEN_REFRESHED when returning to the tab) must not
    // flip loading back to true, which would unmount the entire app.
    setLoading((prev) => (role === null ? true : prev));
    try {
      // Direct query by email (no RPC). Default to least-privileged 'viewer' on any failure.
      const email = (u.email ?? "").toLowerCase();
      const { data: row, error } = await supabase
        .from("user_roles")
        .select("role, display_name, is_owner")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw error;
      const nextRole: AppRole = (row?.role as AppRole | undefined) ?? "viewer";
      const nextOwner = Boolean(row?.is_owner);
      roleLoadedForUserRef.current = u.id;
      setRole(nextRole);
      setIsOwner(nextOwner);
      setDisplayName(
        (row?.display_name as string | null | undefined) ??
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      );
      // eslint-disable-next-line no-console
      console.log("Role loaded:", email, nextRole, nextOwner);
    } catch (error) {
      console.error("[Auth] Failed to load user role", error);
      // SECURITY: default to least-privileged role on failure, never admin.
      setRole("viewer");
      setIsOwner(false);
      setDisplayName(
        (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    let sessionCheckFinished = false;
    // Set up listener BEFORE checking session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const u = session?.user ?? null;
      const previousSession = currentSessionRef.current;
      const sameUser = previousSession?.user?.id === u?.id;
      const sameSession = sameUser && previousSession?.access_token === session?.access_token;
      currentSessionRef.current = session;

      // Avoid reloading role / re-rendering on benign events that fire when
      // the tab regains focus. Only sign-out may clear app state. Repeated
      // sign-in/token events for the same user must preserve mounted children.
      if (event === "SIGNED_OUT") {
        setUser(null);
        void loadRole(null);
        clearAllSessionStorage();
        try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch { /* */ }
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (!u) {
          // No session (e.g. INITIAL_SESSION on a logged-out visit):
          // only settle as signed out after the explicit session check. This
          // prevents a stale null INITIAL_SESSION from winning over the OAuth
          // callback that is being processed at the same time.
          if (sessionCheckFinished) void loadRole(null);
          return;
        }
        setUser(u);
        if (roleLoadedForUserRef.current !== u.id) void loadRole(u);
        try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* */ }
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (!sameSession && !sameUser && u) setUser(u);
        try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* */ }
        return;
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      sessionCheckFinished = true;
      const session = data.session ?? null;
      const u = session?.user ?? null;

      // A newer auth event may have supplied the OAuth session while this
      // request was in flight. Never overwrite it with a stale null result.
      if (!session && currentSessionRef.current?.user) return;

      currentSessionRef.current = session;
      setUser(u);
      void loadRole(u);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Inactivity auto-logout (24h)
  useEffect(() => {
    if (!user) return;
    const touch = () => {
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* */ }
    };
    const check = async () => {
      try {
        const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
        if (Date.now() - last > INACTIVITY_MS) {
          await supabase.auth.signOut();
          clearAllSessionStorage();
        }
      } catch { /* */ }
    };
    touch();
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const interval = window.setInterval(check, 60_000);
    void check();
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(interval);
    };
  }, [user]);

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