import { useMemo, useState } from "react";
import { AlertCircle, Settings as SettingsIcon } from "lucide-react";
import { Header } from "@/components/Header";
import { MarketSelector } from "@/components/MarketSelector";
import { KPISummary } from "@/components/KPISummary";
import { FilterBar } from "@/components/FilterBar";
import { InfluencerCards } from "@/components/InfluencerCards";
import { DataTable } from "@/components/DataTable";
import { CampaignCharts } from "@/components/CampaignCharts";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSheetData } from "@/hooks/useSheetData";
import { useFilters } from "@/hooks/useFilters";
import {
  computeKPIs,
  summarizeInfluencers,
  summarizeMarkets,
} from "@/lib/calculations";

const Index = () => {
  const { config, updateConfig, data, loading, lastFetched, refresh, configured } = useSheetData();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filters = useFilters(data);
  const { selectedCountry, filtered } = filters;

  const marketStats = useMemo(() => summarizeMarkets(data), [data]);
  const totalInfluencers = useMemo(
    () => new Set(data.filter((r) => r.influencer).map((r) => `${r.country}|${r.influencer}`)).size,
    [data],
  );
  const totalViews = useMemo(() => data.reduce((a, r) => a + (r.views ?? 0), 0), [data]);

  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const influencers = useMemo(() => summarizeInfluencers(filtered), [filtered]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        selectedCountry={selectedCountry}
        loading={loading}
        lastFetched={lastFetched}
        onRefresh={refresh}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {!configured ? (
        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <Card className="max-w-md border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <AlertCircle className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Connect your Google Sheet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your spreadsheet ID and Google API key to load campaign data from all 11 markets.
            </p>
            <Button className="mt-6 gap-2" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="h-4 w-4" /> Open settings
            </Button>
          </Card>
        </div>
      ) : (
        <>
          <MarketSelector
            selected={selectedCountry}
            onSelect={filters.setSelectedCountry}
            stats={marketStats}
            totalInfluencers={totalInfluencers}
            totalCampaigns={data.length}
            totalViews={totalViews}
          />

          {loading && data.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 px-6 pt-6 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 bg-card" />
              ))}
            </div>
          ) : (
            <KPISummary kpis={kpis} />
          )}

          <FilterBar
            search={filters.search}
            setSearch={filters.setSearch}
            platform={filters.platform}
            setPlatform={filters.setPlatform}
            hasActiveFilter={filters.hasActiveFilter}
            clear={filters.clear}
            resultCount={filtered.length}
          />

          <InfluencerCards influencers={influencers} />

          <CampaignCharts rows={filtered} selectedCountry={selectedCountry} />

          <DataTable rows={filtered} />

          <div className="h-12" />
        </>
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        onSave={updateConfig}
      />
    </div>
  );
};

export default Index;
