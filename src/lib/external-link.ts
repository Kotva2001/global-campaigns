import type { MouseEvent } from "react";

/**
 * Open an external URL in a new tab without leaking the referrer.
 *
 * Some platforms (notably Instagram) block navigations whose referrer matches
 * a third-party app domain. Even with rel="noopener noreferrer", certain
 * browsers still send a referrer on direct anchor clicks. To work around
 * this, we open about:blank first (which has no referrer), then navigate
 * that new window to the target URL.
 */
export const openExternal = (url: string | null | undefined) => {
  if (!url) return;
  // NOTE: do NOT pass "noopener" here — it forces window.open to return null,
  // which would prevent us from setting the new tab's location. We strip the
  // opener manually below instead.
  const w = window.open("about:blank", "_blank");
  if (w) {
    try {
      w.opener = null;
    } catch {
      // ignore
    }
    w.location.href = url;
  }
};

/**
 * Convenience onClick handler for <a> tags. Prevents the default navigation
 * (which would send a referrer) and routes through openExternal instead.
 */
export const handleExternalClick =
  (url: string | null | undefined) =>
  (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openExternal(url);
  };