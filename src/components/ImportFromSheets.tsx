import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import { Loader2, Download, Eye, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, COUNTRY_FLAGS } from "@/lib/countries";
import { parseRow, parseCzechDate } from "@/lib/parsers";
import { extractYouTubeChannelId, extractYouTubeVideoId } from "@/lib/youtube";
import type { CampaignEntry } from "@/types/campaign";

type Preview = {
  rows: CampaignEntry[];
  influencersByCountry: Map<string, Set<string>>;
  campaignsByCountry: Map<string, number>;
  discoveredTabs: { country: string; tabName: string }[];
  skippedTabs: string[];
  failedTabs: { country: string; reason: string }[];
  tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[];
  warnings: string[];
};

const STORAGE_KEY = "lovable-import-sheets";

const normalizeCollabType = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "barter") return "Barter";
  if (lower === "paid" || lower.includes("placen")) return "Paid";
  return value;
};

type ImportMode = "fresh" | "new-only";

const campaignKey = (row: { influencer_id: string | null; platform: string; publish_date: string | null; video_url?: string | null; campaign_name?: string | null }) => {
  const url = row.video_url?.trim().toLowerCase();
  const campaign = row.campaign_name?.trim().toLowerCase() ?? "";
  return [row.influencer_id ?? "", row.platform, row.publish_date ?? "", url ? `url:${url}` : `campaign:${campaign}`].join("|");
};

export const ImportFromSheets = () => {
  const initial = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
    catch { return {}; }
  })();
  const [sheetId, setSheetId] = useState<string>(initial.sheetId ?? "");
  const [apiKey, setApiKey] = useState<string>(initial.apiKey ?? "");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  const fetchAllTabs = async (): Promise<{
    rows: CampaignEntry[];
    discoveredTabs: { country: string; tabName: string }[];
    skippedTabs: string[];
    failedTabs: { country: string; reason: string }[];
    tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[];
  }> => {
    const all: CampaignEntry[] = [];
    const failedTabs: { country: string; reason: string }[] = [];
    const tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[] = [];
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?key=${encodeURIComponent(apiKey)}&fields=sheets.properties.title`;
    console.log("[Import] Fetching spreadsheet metadata:", metadataUrl);
    const metaResponse = await fetch(metadataUrl);
    console.log(`[Import] Metadata response status: ${metaResponse.status}`);
    if (!metaResponse.ok) {
      const body = await metaResponse.json().catch(() => ({}));
      const reason = body?.error?.message ?? metaResponse.statusText;
      throw new Error(metaResponse.status === 403
        ? "Sheet is not publicly accessible. Please share it as 'Anyone with the link can view' in Google Sheets sharing settings."
        : `Could not read spreadsheet tabs: ${reason}`);
    }
    const metaData = await metaResponse.json();
    console.log("[Import] Metadata raw data:", metaData);
    const availableTabs: string[] = metaData.sheets?.map((s: { properties?: { title?: string } }) => s.properties?.title).filter(Boolean) ?? [];
    console.log("[Import] Available tabs in spreadsheet:", availableTabs);

    const discoveredTabs: { country: string; tabName: string }[] = [];
    for (const tabName of availableTabs) {
      const trimmed = tabName.trim().toUpperCase();
      const direct = COUNTRIES.find((country) => country === trimmed);
      if (direct) {
        discoveredTabs.push({ country: direct, tabName });
        continue;
      }
      const partial = COUNTRIES.find((country) =>
        trimmed.startsWith(`${country} `) || trimmed.startsWith(`${country}-`) || trimmed.startsWith(`${country} (`),
      );
      if (partial) discoveredTabs.push({ country: partial, tabName });
    }
    const skippedTabs = availableTabs.filter((tab) => !discoveredTabs.some((mapped) => mapped.tabName === tab));
    console.log("[Import] Tab mapping:", discoveredTabs);
    console.log("[Import] Unmatched tabs:", skippedTabs);

    const mappedCountries = new Set(discoveredTabs.map((tab) => tab.country));
    COUNTRIES.forEach((country) => {
      if (!mappedCountries.has(country)) {
        const reason = "no matching sheet tab found";
        failedTabs.push({ country, reason });
        tabResults.push({ country, rowCount: 0, status: "failed", reason });
      }
    });

    for (const { country, tabName } of discoveredTabs) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(tabName)}?key=${encodeURIComponent(apiKey)}`;
      console.log(`[Import] Fetching tab: ${country} (${tabName})`);
      console.log(`[Import] URL: ${url}`);
      try {
        const r = await fetch(url);
        console.log(`[Import] ${country} response status: ${r.status}`);
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          const reason = body?.error?.message ?? r.statusText;
          if (r.status === 403) {
            console.error(`[Import] 403 — sheet not publicly accessible. Share as 'Anyone with the link can view'.`);
            failedTabs.push({ country, reason: "403 — sheet not publicly accessible (share as 'Anyone with the link can view')" });
            tabResults.push({ country, rowCount: 0, status: "failed", reason: "403 — sheet not publicly accessible" });
          } else if (r.status === 400) {
            console.warn(`[Import] Tab "${country}" returned 400 — likely missing tab, skipping`);
            failedTabs.push({ country, reason: "tab not found" });
            tabResults.push({ country, rowCount: 0, status: "failed", reason: "400 — tab not found" });
          } else {
            console.warn(`[Import] Tab "${country}" returned ${r.status}: ${reason}`);
            failedTabs.push({ country, reason: `${r.status}: ${reason}` });
            tabResults.push({ country, rowCount: 0, status: "failed", reason: `${r.status}: ${reason}` });
          }
          continue;
        }
        const data = await r.json();
        console.log(`[Import] Raw data:`, data);
        const values: unknown[][] = data.values ?? [];
        console.log(`[Import] ${country}: ${values.length} total rows (incl. header)`);
        if (values.length > 0) console.log(`[Import] ${country} header:`, values[0]);
        if (values.length > 1) console.log(`[Import] ${country} first data row:`, values[1]);
        if (values.length < 2) {
          console.log(`[Import] ${country}: no data rows, skipping`);
          tabResults.push({ country, rowCount: 0, status: "success" });
          continue;
        }
        let addedForCountry = 0;
        const dataRows = values.slice(1);
        dataRows.forEach((row, idx) => {
          const r0 = (row ?? []) as unknown[];
          const entry = parseRow(r0, country, idx + 2);
          if (entry.influencer) {
            all.push(entry);
            addedForCountry += 1;
          } else {
            console.log(`[Import] Skipping empty row in ${country}`, r0);
          }
        });
        console.log(`[Import] ${country}: ${addedForCountry} parsed rows`);
        tabResults.push({ country, rowCount: addedForCountry, status: "success" });
      } catch (err) {
        console.error(`[Import] Error fetching ${country}:`, err);
        const reason = (err as Error).message;
        failedTabs.push({ country, reason });
        tabResults.push({ country, rowCount: 0, status: "failed", reason });
      }
    }
    console.log(`[Import] Total parsed rows: ${all.length}`);
    return { rows: all, discoveredTabs, skippedTabs, failedTabs, tabResults };
  };

  const buildPreview = (
    rows: CampaignEntry[],
    discoveredTabs: { country: string; tabName: string }[],
    skippedTabs: string[],
    failedTabs: { country: string; reason: string }[],
    tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[],
  ): Preview => {
    const influencersByCountry = new Map<string, Set<string>>();
    const campaignsByCountry = new Map<string, number>();
    const warnings: string[] = [];
    for (const r of rows) {
      if (!r.influencer) {
        warnings.push(`Row in ${r.country}: missing influencer name`);
        continue;
      }
      if (!influencersByCountry.has(r.country)) influencersByCountry.set(r.country, new Set());
      influencersByCountry.get(r.country)!.add(r.influencer);
      campaignsByCountry.set(r.country, (campaignsByCountry.get(r.country) ?? 0) + 1);
    }
    skippedTabs.forEach((tab) => warnings.push(`Tab "${tab}" was not matched to any country. Should it be imported?`));
    return { rows, influencersByCountry, campaignsByCountry, discoveredTabs, skippedTabs, failedTabs, tabResults, warnings };
  };

  const onPreview = async () => {
    if (!sheetId || !apiKey) { toast.error("Sheet ID and API key required"); return; }
    setLoading(true);
    setPreview(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheetId, apiKey }));
      const { rows, discoveredTabs, skippedTabs, failedTabs, tabResults } = await fetchAllTabs();
      const p = buildPreview(rows, discoveredTabs, skippedTabs, failedTabs, tabResults);
      setPreview(p);
      if (rows.length === 0) {
        toast.warning(failedTabs.length ? `0 rows — ${failedTabs.length} tab(s) failed. See console.` : "0 rows found. Check console for details.");
      } else {
        toast.success(`Loaded ${rows.length} rows from ${p.influencersByCountry.size} markets`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const performImport = async (mode: ImportMode) => {
    if (!preview) return;
    setImporting(true);
    setProgress(0);
    try {
      if (mode === "fresh") {
        const { error } = await supabase.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      }

      // Step 1: upsert influencers
      const influencerKeys = new Map<string, string>(); // key=country|name -> id
      const tasks: { country: string; name: string }[] = [];
      preview.influencersByCountry.forEach((names, country) => {
        names.forEach((name) => tasks.push({ country, name }));
      });

      // First check existing
      const { data: existingInf } = await supabase
        .from("influencers")
        .select("id,name,country");
      const existingMap = new Map<string, string>();
      (existingInf ?? []).forEach((i) => existingMap.set(`${i.country}|${i.name}`, i.id));

      // Insert missing
      const toInsert = tasks
        .filter((t) => !existingMap.has(`${t.country}|${t.name}`))
        .map((t) => {
          // Try to extract channel from any campaign with a video URL
          const sampleRow = preview.rows.find(
            (r) => r.country === t.country && r.influencer === t.name && r.videoLink,
          );
          const channelId = sampleRow ? extractYouTubeChannelId(sampleRow.videoLink) : null;
          return {
            name: t.name,
            country: t.country,
            platforms: ["YouTube"],
            youtube_channel_id: channelId,
            status: "active",
          };
        });

      if (toInsert.length) {
        const { data: inserted, error } = await supabase
          .from("influencers")
          .insert(toInsert)
          .select("id,name,country");
        if (error) throw error;
        (inserted ?? []).forEach((i) => existingMap.set(`${i.country}|${i.name}`, i.id));
      }
      tasks.forEach((t) => influencerKeys.set(`${t.country}|${t.name}`, existingMap.get(`${t.country}|${t.name}`)!));

      setProgress(30);

      const existingCampaignKeys = new Set<string>();
      if (mode === "new-only") {
        const { data: existingCampaigns, error } = await supabase
          .from("campaigns")
          .select("influencer_id,platform,publish_date,video_url,campaign_name");
        if (error) throw error;
        (existingCampaigns ?? []).forEach((row) => existingCampaignKeys.add(campaignKey(row)));
      }

      const campaignRows = preview.rows.map((r) => {
        const dt = parseCzechDate(r.publishDate);
        const row = {
          influencer_id: influencerKeys.get(`${r.country}|${r.influencer}`) ?? null,
          campaign_name: r.campaignName || null,
          platform: r.platform,
          publish_date: dt ? dt.toISOString().slice(0, 10) : null,
          video_url: r.videoLink || null,
          video_id: extractYouTubeVideoId(r.videoLink),
          collaboration_type: normalizeCollabType(r.collaborationType),
          currency: r.currency,
          campaign_cost: r.campaignCost ?? 0,
          utm_link: r.utmLink || null,
          managed_by: r.managedBy || null,
          views: r.views ?? 0,
          likes: r.likes ?? 0,
          comments: r.comments ?? 0,
          sessions: r.sessions ?? 0,
          engagement_rate: r.engagementRate,
          purchase_revenue: r.purchaseRevenue ?? 0,
          conversion_rate: r.conversionRate,
        };
        return row;
      }).filter((row) => mode === "fresh" || !existingCampaignKeys.has(campaignKey(row)));

      // Step 2: insert campaigns in batches of 100
      const total = campaignRows.length;
      let done = 0;
      const BATCH = 100;
      for (let i = 0; i < total; i += BATCH) {
        const batch = campaignRows.slice(i, i + BATCH);
        const { error } = await supabase.from("campaigns").insert(batch);
        if (error) throw error;
        done += batch.length;
        setProgress(total ? 30 + Math.round((done / total) * 70) : 100);
      }

      toast.success(`Imported ${tasks.length} influencers and ${total} campaigns`);
      window.dispatchEvent(new Event("campaign-data-changed"));
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  const onImport = async () => {
    if (!preview) return;
    const { count, error } = await supabase.from("campaigns").select("*", { count: "exact", head: true });
    if (error) return toastError("Import failed", error);
    if ((count ?? 0) > 0) {
      setExistingCount(count ?? 0);
      setConfirmImportOpen(true);
      return;
    }
    void performImport("new-only");
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">Import from Google Sheets</h3>
        <p className="text-xs text-muted-foreground">
          One-time migration from your existing spreadsheet
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="imp-sheet">Google Sheet ID</Label>
          <Input
            id="imp-sheet"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="1AbCdEfGhIjKlMnOp…"
            className="font-mono text-xs"
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="imp-key">Google API key</Label>
          <Input
            id="imp-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            type="password"
            className="font-mono text-xs"
            maxLength={200}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={onPreview}
          disabled={loading || importing || !sheetId || !apiKey}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Preview
        </Button>
        <Button
          onClick={onImport}
          disabled={!preview || importing}
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Import
        </Button>
      </div>

      {importing && <Progress value={progress} />}

      {preview && (
        <div className="space-y-3 rounded border bg-muted/40 p-3 text-sm">
          <div>
            <div className="font-medium">
              Found {[...preview.influencersByCountry.values()].reduce((a, s) => a + s.size, 0)} unique influencers
              across {preview.influencersByCountry.size} markets
            </div>
            <div className="text-muted-foreground">{preview.rows.length} campaign entries</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Discovered tabs: {preview.discoveredTabs.length
                ? preview.discoveredTabs.map((tab) => tab.tabName === tab.country ? tab.country : `${tab.country} (${tab.tabName})`).join(", ")
                : "none"}
            </div>
            {preview.skippedTabs.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                Other tabs (skipped): {preview.skippedTabs.join(", ")}
              </div>
            )}
            {preview.rows.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                Sample: {preview.rows.slice(0, 3).map((r) => r.influencer).join(", ")}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              {preview.tabResults.map((tab) => (
                <div key={tab.country} className="text-xs text-muted-foreground">
                  {tab.status === "success"
                    ? `${tab.country}: ${tab.rowCount} rows found`
                    : `${tab.country}: fetch failed (${tab.reason})`}
                </div>
              ))}
            </div>

            {[...preview.influencersByCountry.entries()].map(([country, names]) => (
              <div key={country} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {COUNTRY_FLAGS[country]} {country} · {names.size} influencers · {preview.campaignsByCountry.get(country) ?? 0} campaigns
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {[...names].slice(0, 6).join(", ")}{names.size > 6 ? `, +${names.size - 6} more` : ""}
                </span>
              </div>
            ))}
          </div>

          {preview.failedTabs.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" /> {preview.failedTabs.length} tab(s) failed
              </div>
              <ul className="max-h-32 list-disc overflow-auto pl-5 text-xs text-muted-foreground">
                {preview.failedTabs.map((f) => (
                  <li key={f.country}>
                    {COUNTRY_FLAGS[f.country] ?? ""} {f.country}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                <AlertTriangle className="h-3 w-3" /> {preview.warnings.length} warning(s)
              </div>
              <ul className="max-h-32 list-disc overflow-auto pl-5 text-xs text-muted-foreground">
                {preview.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                {preview.warnings.length > 20 && <li>… and {preview.warnings.length - 20} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Campaigns already exist</AlertDialogTitle>
            <AlertDialogDescription>There are already {existingCount} campaigns in the database. What would you like to do?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmImportOpen(false); void performImport("new-only"); }}>Import only new</AlertDialogAction>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setConfirmImportOpen(false); void performImport("fresh"); }}>Clear & reimport</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
