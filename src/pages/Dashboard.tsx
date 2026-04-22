import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { MarketSelector } from "@/components/MarketSelector";
import { KPISummary } from "@/components/KPISummary";
import { FilterBar } from "@/components/FilterBar";
import { InfluencerCards } from "@/components/InfluencerCards";
import { DataTable } from "@/components/DataTable";
import { CampaignCharts } from "@/components/CampaignCharts";
import { CampaignDialog } from "@/components/CampaignDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSheetData } from "@/hooks/useSheetData";
import { useFilters } from "@/hooks/useFilters";
import {
  computeKPIs,
  summarizeInfluencers,
  summarizeMarkets,
} from "@/lib/calculations";
import { COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";

const Dashboard = () => {
  const { data, loading, lastFetched, refresh } = useSheetData();
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
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

  const marketLabel =
    selectedCountry === "All"
      ? "🌍 All markets"
      : `${COUNTRY_FLAGS[selectedCountry] ?? ""} ${COUNTRY_NAMES[selectedCountry] ?? selectedCountry}`;

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
            <p className="text-xs text-muted-foreground">{marketLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <span className="hidden text-xs text-muted-foreground md:inline">
                Updated {lastFetched.toLocaleTimeString("cs-CZ")}
              </span>
            )}
            <Button size="sm" onClick={() => { setEditingCampaign(null); setCampaignOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Campaign
            </Button>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

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
      <DataTable
        rows={filtered}
        onChanged={refresh}
        onAddCampaign={() => { setEditingCampaign(null); setCampaignOpen(true); }}
        onEditCampaign={(campaign) => { setEditingCampaign(campaign); setCampaignOpen(true); }}
      />
      <CampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        editing={editingCampaign}
        onSaved={() => {
          setCampaignOpen(false);
          setEditingCampaign(null);
          void refresh();
        }}
      />
      <div className="h-12" />
    </div>
  );
};

export default Dashboard;
