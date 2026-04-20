/** Extract YouTube channel ID from a URL. Returns null if it can't be detected
 *  synchronously (e.g. /@handle or /c/customName which require API resolution). */
export const extractYouTubeChannelId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
};

/** Extract YouTube video ID from common URL formats. */
export const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};
