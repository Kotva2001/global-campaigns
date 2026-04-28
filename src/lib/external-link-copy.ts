import { toast } from "sonner";

const COPY_TOAST = "📋 Link copied! Paste in a new tab to view.";

/**
 * Returns true if the URL is an Instagram URL (instagram.com hostname).
 * Used to decide whether to show a copy-link button instead of opening
 * a new tab (Instagram blocks navigations from external referrers).
 */
export const isInstagramUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith("instagram.com");
  } catch {
    return false;
  }
};

export const copyExternalLinkToClipboard = (url: string | null | undefined) => {
  if (!url) return;

  void navigator.clipboard.writeText(url).catch(() => undefined);
  toast(COPY_TOAST);
};