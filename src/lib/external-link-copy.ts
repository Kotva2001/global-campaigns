import { toast } from "sonner";

const COPY_TOAST = "Link copied! If Instagram blocks it, paste in a new tab.";

export const copyExternalLinkToClipboard = (url: string | null | undefined) => {
  if (!url) return;

  void navigator.clipboard.writeText(url).catch(() => undefined);
  toast(COPY_TOAST);
};