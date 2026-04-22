import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrencySettings } from "@/hooks/useCurrencySettings";

export const ExchangeRateSettings = () => {
  const { eurCzkRate, rateUpdatedAt, loadingRate, saveRate } = useCurrencySettings();
  const [draft, setDraft] = useState(String(eurCzkRate));
  const [fetching, setFetching] = useState(false);

  useEffect(() => setDraft(String(eurCzkRate)), [eurCzkRate]);

  const fetchCurrentRate = async () => {
    setFetching(true);
    try {
      const response = await fetch("https://api.frankfurter.app/latest?from=EUR&to=CZK");
      const data = await response.json();
      const rate = Number(data?.rates?.CZK);
      if (Number.isFinite(rate)) await saveRate(rate);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">Exchange rates</h3>
        <p className="text-xs text-muted-foreground">Used to convert EUR campaign values into dashboard totals.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="eurRate">EUR → CZK rate</Label>
          <Input id="eurRate" type="number" min="0" step="0.01" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <p className="text-xs text-muted-foreground">Last updated: {rateUpdatedAt ? new Date(rateUpdatedAt).toLocaleString("cs-CZ") : "—"}</p>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="secondary" onClick={() => void fetchCurrentRate()} disabled={fetching || loadingRate} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} /> Fetch current rate
          </Button>
          <Button onClick={() => void saveRate(Number(draft))} disabled={!Number.isFinite(Number(draft)) || loadingRate}>Save</Button>
        </div>
      </div>
    </div>
  );
};
