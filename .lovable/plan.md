## Goal
Stop the Google Sheets importer from writing non-URL values (e.g. "Stories", arbitrary text, Drive links) into `campaigns.video_url`, and clean up the bad rows already in the database.

## Root cause
`src/lib/parsers.ts` maps spreadsheet column 4 to `videoLink`, and `src/components/ImportFromSheets.tsx` (line 288) passes that value straight to `campaigns.video_url`. When a row has "Stories" (or any label) in column 4 instead of an actual Instagram/YouTube URL, the label is persisted.

Current DB damage (audited): 7 rows with `video_url = "Stories"`, 1 row with a `drive.google.com` URL. All other rows are valid Instagram/YouTube/TikTok URLs.

## Changes

### 1. `src/lib/parsers.ts`
Add a small `sanitizeVideoUrl(raw)` helper:
- Trim.
- Accept only values that start with `http://` or `https://` AND whose host matches `instagram.com`, `youtube.com`, `youtu.be`, or `tiktok.com` (sub-domains allowed).
- Reject Google Drive, Google Docs, and any non-URL text. Returns `""`.

Apply it in `parseRow`:
```ts
videoLink: sanitizeVideoUrl(c(4)),
```

This keeps `videoLink` as `string` (existing type) — invalid values just become empty.

### 2. `src/components/ImportFromSheets.tsx`
No mapping change needed once parser is fixed; line 288 already does `r.videoLink || null`, so empty becomes `null`.

Add one defensive guard right before building `campaignRows`: log a warning count of rows whose original column-4 value was dropped, so future imports surface bad sheet data (optional, useful for QA).

### 3. Data cleanup migration
One SQL migration that nulls the 8 bad rows:
```sql
UPDATE public.campaigns
SET video_url = NULL
WHERE video_url IS NOT NULL
  AND video_url !~* '^https?://([a-z0-9-]+\.)*(instagram\.com|youtube\.com|youtu\.be|tiktok\.com)/';
```
No row deletion — only the malformed `video_url` is cleared so the rest of the campaign data is preserved.

## Out of scope
- ApproveDialog defensive guard (option 2) — not changing, since `detected_videos.video_url` is already guaranteed-URL from the scanner.
- Importer UI redesign.

## Verification
1. Re-run audit query — expect 0 rows with non-platform video_url.
2. Spot-check a known-good Instagram and YouTube import row remains intact.
3. Re-import a sheet with a "Stories" label in column E → row inserts with `video_url = NULL` instead of "Stories".
