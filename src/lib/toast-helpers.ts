import { toast } from "sonner";

/**
 * Show a user-friendly error toast. Logs the raw error to the console
 * for debugging but presents a clear, action-oriented message to the user.
 */
export const toastError = (
  context: string,
  error: { message?: string } | string | unknown,
) => {
  const raw = typeof error === "string" ? error : (error as { message?: string })?.message ?? "";
  if (raw) console.error(`[${context}]`, error);
  const friendly = friendlyMessage(raw);
  toast.error(context, friendly ? { description: friendly } : undefined);
};

const friendlyMessage = (raw: string): string => {
  if (!raw) return "Please try again or contact support if the issue persists.";
  const lower = raw.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Network connection issue — please check your internet and try again.";
  }
  if (lower.includes("jwt") || lower.includes("not authenticated") || lower.includes("auth")) {
    return "You need to be signed in to perform this action.";
  }
  if (lower.includes("row-level security") || lower.includes("permission") || lower.includes("policy")) {
    return "You don't have permission to perform this action.";
  }
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "This item already exists.";
  }
  if (lower.includes("violates") && lower.includes("not-null")) {
    return "Some required fields are missing.";
  }
  if (lower.includes("foreign key")) {
    return "Cannot complete this action because related data is in use.";
  }
  // Fall back to the raw message but keep it short.
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
};