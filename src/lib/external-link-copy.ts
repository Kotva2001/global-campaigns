import { toast } from "sonner";

const COPY_TOAST = "Link copied! If Instagram blocks it, paste in a new tab.";

export const copyExternalLinkToClipboard = (url: string | null | undefined) => {
  if (!url) return;

  void navigator.clipboard.writeText(url).catch(() => undefined);
  toast(COPY_TOAST);
};

/**
 * Wraps Instagram URLs in our /go redirect page (which strips the Referer
 * header so Instagram won't block the navigation). Other URLs (YouTube,
 * unknown) are returned unchanged.
 */
export const wrapExternalUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("instagram.com")) {
      return `/go?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // not a parseable URL, fall through
  }
  return url;
};