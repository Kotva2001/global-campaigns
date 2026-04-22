import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_RATES, type CurrencyCode } from "@/lib/currency";

const DISPLAY_KEY = "dashboard-display-currency";

interface SettingsRow {
  id: string;
  eur_czk_rate: number | string | null;
  eur_czk_rate_updated_at: string | null;
}

export const useCurrencySettings = () => {
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(() => (localStorage.getItem(DISPLAY_KEY) as CurrencyCode) || "CZK");
  const [eurCzkRate, setEurCzkRate] = useState(DEFAULT_RATES.EUR_CZK);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  const loadRate = useCallback(async () => {
    const { data, error } = await supabase.from("scan_settings").select("id, eur_czk_rate, eur_czk_rate_updated_at").limit(1).maybeSingle();
    if (error) return;
    const row = data as unknown as SettingsRow | null;
    if (row?.eur_czk_rate != null) setEurCzkRate(Number(row.eur_czk_rate));
    setRateUpdatedAt(row?.eur_czk_rate_updated_at ?? null);
  }, []);

  useEffect(() => {
    void loadRate();
    const handler = () => void loadRate();
    window.addEventListener("currency-settings-changed", handler);
    return () => window.removeEventListener("currency-settings-changed", handler);
  }, [loadRate]);

  const setDisplayCurrency = (currency: CurrencyCode) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem(DISPLAY_KEY, currency);
  };

  const saveRate = async (rate: number) => {
    setLoadingRate(true);
    const { data } = await supabase.from("scan_settings").select("id").limit(1).maybeSingle();
    const row = data as { id: string } | null;
    const payload = { eur_czk_rate: rate, eur_czk_rate_updated_at: new Date().toISOString() } as never;
    const result = row
      ? await supabase.from("scan_settings").update(payload).eq("id", row.id)
      : await supabase.from("scan_settings").insert(payload);
    setLoadingRate(false);
    if (result.error) return toast.error(result.error.message);
    setEurCzkRate(rate);
    setRateUpdatedAt(new Date().toISOString());
    window.dispatchEvent(new Event("currency-settings-changed"));
    toast.success("Exchange rate updated");
  };

  return { displayCurrency, setDisplayCurrency, eurCzkRate, rateUpdatedAt, loadingRate, saveRate, refreshRate: loadRate };
};
