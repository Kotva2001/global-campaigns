import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  failedTabs: { country: string; reason: string }[];
  tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[];
  warnings: string[];
};

const STORAGE_KEY = "lovable-import-sheets";

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

  const fetchAllTabs = async (): Promise<{
    rows: CampaignEntry[];
    failedTabs: { country: string; reason: string }[];
    tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[];
  }> => {
    const all: CampaignEntry[] = [];
    const failedTabs: { country: string; reason: string }[] = [];
    const tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[] = [];
    for (const country of COUNTRIES) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(country)}?key=${encodeURIComponent(apiKey)}`;
      console.log(`[Import] Fetching tab: ${country}`);
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
    return { rows: all, failedTabs, tabResults };
  };

  const buildPreview = (
    rows: CampaignEntry[],
    failedTabs: { country: string; reason: string }[],
    tabResults: { country: string; rowCount: number; status: "success" | "failed"; reason?: string }[],
  ): Preview => {
    const influencersByCountry = new Map<string, Set<string>>();
    const campaignsByCountry = new Map<string, number>();
    const warnings: string[] = [];
    const seenVideoLinks = new Set<string>();
    for (const r of rows) {
      if (!r.influencer) {
        warnings.push(`Row in ${r.country}: missing influencer name`);
        continue;
      }
      if (!influencersByCountry.has(r.country)) influencersByCountry.set(r.country, new Set());
      influencersByCountry.get(r.country)!.add(r.influencer);
      campaignsByCountry.set(r.country, (campaignsByCountry.get(r.country) ?? 0) + 1);
      const key = r.videoLink.trim();
      if (key) {
        if (seenVideoLinks.has(key)) warnings.push(`Duplicate video URL: ${key}`);
        seenVideoLinks.add(key);
      }
    }
    return { rows, influencersByCountry, campaignsByCountry, failedTabs, tabResults, warnings };
  };

  const onPreview = async () => {
    if (!sheetId || !apiKey) { toast.error("Sheet ID and API key required"); return; }
    setLoading(true);
    setPreview(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheetId, apiKey }));
      const { rows, failedTabs, tabResults } = await fetchAllTabs();
      const p = buildPreview(rows, failedTabs, tabResults);
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

  const onImport = async () => {
    if (!preview) return;
    setImporting(true);
    setProgress(0);
    try {
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

      // Step 2: insert campaigns in batches of 100
      const total = preview.rows.length;
      let done = 0;
      const BATCH = 100;
      for (let i = 0; i < total; i += BATCH) {
        const batch = preview.rows.slice(i, i + BATCH).map((r) => {
          const dt = parseCzechDate(r.publishDate);
          return {
            influencer_id: influencerKeys.get(`${r.country}|${r.influencer}`) ?? null,
            campaign_name: r.campaignName || null,
            platform: r.platform,
            publish_date: dt ? dt.toISOString().slice(0, 10) : null,
            video_url: r.videoLink || null,
            video_id: extractYouTubeVideoId(r.videoLink),
            collaboration_type: r.collaborationType || null,
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
        });
        const { error } = await supabase.from("campaigns").insert(batch);
        if (error) throw error;
        done += batch.length;
        setProgress(30 + Math.round((done / total) * 70));
      }

      toast.success(`Imported ${tasks.length} influencers and ${total} campaigns`);
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
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
    </div>
  );
};
