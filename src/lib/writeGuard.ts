import { toast } from "sonner";

export type Role = "admin" | "editor" | "viewer" | null;

/**
 * Client-side guard for write operations. Returns true if allowed.
 * Always paired with server-side RLS — this is just for UX feedback.
 */
export const canEditRole = (role: Role): boolean =>
  role === "admin" || role === "editor";

export const assertCanEdit = (role: Role): boolean => {
  if (!canEditRole(role)) {
    toast.error("Insufficient permissions", {
      description: "Your account does not have permission to perform this action.",
    });
    return false;
  }
  return true;
};

export const assertIsAdmin = (role: Role): boolean => {
  if (role !== "admin") {
    toast.error("Admin only", {
      description: "Only administrators can perform this action.",
    });
    return false;
  }
  return true;
};