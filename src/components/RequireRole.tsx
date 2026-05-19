import { Navigate } from "react-router-dom";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** Roles allowed to view the route. */
  allow: AppRole[];
  /** Optional owner-only override (must also satisfy `allow`). */
  ownerOnly?: boolean;
  children: React.ReactNode;
}

/**
 * Route-level RBAC guard. Redirects unauthorized users to /dashboard.
 * Server-side RLS remains the source of truth.
 */
export const RequireRole = ({ allow, ownerOnly = false, children }: Props) => {
  const { role, isOwner, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }
  if (!role) return <Navigate to="/dashboard" replace />;
  if (ownerOnly && !isOwner) return <Navigate to="/dashboard" replace />;
  if (!allow.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};