/** Extract YouTube channel ID from a URL. Returns null if it can't be detected
 *  synchronously (e.g. /@handle or /c/customName which require API resolution). */
export const extractYouTubeChannelId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
};
