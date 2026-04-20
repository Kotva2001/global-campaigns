import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/countries";
import { parseRow } from "@/lib/parsers";
import type { CampaignEntry } from "@/types/campaign";

export interface SheetConfig {
  sheetId: string;
  apiKey: string;
}

const STORAGE_KEY = "irt.sheet.config";

export const loadConfig = (): SheetConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SheetConfig;
  } catch {
    /* ignore */
  }
  return { sheetId: "", apiKey: "" };
};

export const saveConfig = (cfg: SheetConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
};

export const useSheetData = () => {
  const [config, setConfig] = useState<SheetConfig>(() => loadConfig());
  const [data, setData] = useState<CampaignEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchAll = useCallback(async (cfg: SheetConfig) => {
    if (!cfg.sheetId || !cfg.apiKey) {
      setError("Missing Sheet ID or API Key");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        COUNTRIES.map(async (country) => {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}/values/${encodeURIComponent(
            country,
          )}?key=${cfg.apiKey}`;
          try {
            const res = await fetch(url);
            if (!res.ok) {
              if (res.status !== 400 && res.status !== 404) {
                toast.error(`Failed to load ${country} (${res.status})`);
              }
              return [] as CampaignEntry[];
            }
            const json = await res.json();
            if (!json.values || json.values.length < 2) return [] as CampaignEntry[];
            return (json.values.slice(1) as unknown[][]).map((row, i) =>
              parseRow(row, country, i),
            );
          } catch {
            toast.error(`Network error fetching ${country}`);
            return [] as CampaignEntry[];
          }
        }),
      );
      setData(results.flat());
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config.sheetId && config.apiKey) void fetchAll(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = (cfg: SheetConfig) => {
    setConfig(cfg);
    saveConfig(cfg);
    void fetchAll(cfg);
  };

  return {
    config,
    updateConfig,
    data,
    loading,
    error,
    lastFetched,
    refresh: () => fetchAll(config),
    configured: !!(config.sheetId && config.apiKey),
  };
};
