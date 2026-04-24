import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { EuropeMap } from "@/components/EuropeMap";
import { KPISummary } from "@/components/KPISummary";
import { FilterBar } from "@/components/FilterBar";
import { InfluencerCards } from "@/components/InfluencerCards";
import { InfluencerDetailPanel } from "@/components/InfluencerDetailPanel";
import { CreatorDialog } from "@/components/CreatorDialog";
import { DataTable } from "@/components/DataTable";
import { CampaignCharts } from "@/components/CampaignCharts";
import { CampaignDialog } from "@/components/CampaignDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSheetData } from "@/hooks/useSheetData";
import { useCurrencySettings } from "@/hooks/useCurrencySettings";
import { useFilters } from "@/hooks/useFilters";
import {
  computeKPIs,
  type InfluencerSummary,
  summarizeInfluencers,
} from "@/lib/calculations";
import { COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import type { InfluencerRecord } from "@/types/campaign";

const Dashboard = () => {
  const { data, loading, lastFetched, refresh } = useSheetData();
  const { displayCurrency, setDisplayCurrency, eurCzkRate } = useCurrencySettings();
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [detailCreator, setDetailCreator] = useState<InfluencerRecord | null>(null);
  const [campaignInfluencerId, setCampaignInfluencerId] = useState<string | null>(null);
  const filters = useFilters(data);
  const { selectedCountry, filtered } = filters;

  const rates = useMemo(() => ({ EUR_CZK: eurCzkRate }), [eurCzkRate]);
  const kpis = useMemo(() => computeKPIs(filtered, displayCurrency, rates), [displayCurrency, filtered, rates]);
  const influencers = useMemo(() => summarizeInfluencers(filtered, displayCurrency, rates), [displayCurrency, filtered, rates]);
  const detailCampaigns = useMemo(() => detailCreator ? data.filter((campaign) => campaign.influencerId === detailCreator.id) : [], [data, detailCreator]);
  const convertedSub = useMemo(() => {
    const eur = filtered.reduce((sum, row) => sum + (row.currency === "EUR" ? (row.campaignCost ?? 0) : 0), 0);
    return eur > 0 && displayCurrency === "CZK" ? `(incl. ${eur.toLocaleString("cs-CZ")} € converted)` : undefined;
  }, [displayCurrency, filtered]);

  const marketLabel =
    selectedCountry === "All"
      ? "🌍 All markets"
      : `${COUNTRY_FLAGS[selectedCountry] ?? ""} ${COUNTRY_NAMES[selectedCountry] ?? selectedCountry}`;

  const openInfluencerDetail = async (influencer: InfluencerSummary) => {
    const campaignsForInfluencer = filtered.filter((campaign) => campaign.country === influencer.country && campaign.influencer === influencer.influencer);
    const influencerId = campaignsForInfluencer.find((campaign) => campaign.influencerId)?.influencerId ?? null;
    if (!influencerId) return;
    const { data: creator } = await supabase.from("influencers").select("*").eq("id", influencerId).maybeSingle();
    setDetailCreator((creator as InfluencerRecord | null) ?? {
      id: influencerId,
      name: influencer.influencer,
      country: influencer.country,
      platforms: influencer.platforms,
      youtube_channel_id: null,
      youtube_channel_url: null,
      instagram_handle: null,
      contact_email: null,
      contact_person: null,
      notes: null,
      status: "active",
    });
  };

  const refreshAndUpdateDetail = async () => {
    await refresh();
  };

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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Display in</span>
              <Select value={displayCurrency} onValueChange={(value) => setDisplayCurrency(value as typeof displayCurrency)}>
                <SelectTrigger className="h-9 w-[86px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CZK">CZK</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => { setEditingCampaign(null); setCampaignInfluencerId(null); setCampaignOpen(true); }} className="gap-2">
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

      <EuropeMap
        rows={data}
        selected={selectedCountry}
        onSelect={filters.setSelectedCountry}
        displayCurrency={displayCurrency}
        rates={rates}
      />

      {loading && data.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 px-6 pt-6 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-card" />
          ))}
        </div>
      ) : (
        <KPISummary kpis={kpis} currency={displayCurrency} convertedSub={convertedSub} />
      )}

      {loading && data.length === 0 ? (
        <DashboardBodySkeleton />
      ) : (
        <>
          <FilterBar
            search={filters.search}
            setSearch={filters.setSearch}
            platform={filters.platform}
            setPlatform={filters.setPlatform}
            hasActiveFilter={filters.hasActiveFilter}
            clear={filters.clear}
            resultCount={filtered.length}
          />

          <InfluencerCards influencers={influencers} currency={displayCurrency} onSelectInfluencer={openInfluencerDetail} />
          <CampaignCharts rows={filtered} selectedCountry={selectedCountry} displayCurrency={displayCurrency} rates={rates} />
          <DataTable
            rows={filtered}
            onChanged={refresh}
            onAddCampaign={() => { setEditingCampaign(null); setCampaignInfluencerId(null); setCampaignOpen(true); }}
            onEditCampaign={(campaign) => { setEditingCampaign(campaign); setCampaignOpen(true); }}
          />
        </>
      )}
      <CampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        editing={editingCampaign}
        initialInfluencerId={campaignInfluencerId}
        onSaved={() => {
          setCampaignOpen(false);
          setEditingCampaign(null);
          setCampaignInfluencerId(null);
          void refresh();
        }}
      />
      <CreatorDialog open={creatorOpen} onOpenChange={setCreatorOpen} editing={detailCreator} onSaved={() => { setCreatorOpen(false); void refresh(); }} />
      <InfluencerDetailPanel
        creator={detailCreator}
        campaigns={detailCampaigns}
        displayCurrency={displayCurrency}
        rates={rates}
        onClose={() => setDetailCreator(null)}
        onEditInfluencer={() => setCreatorOpen(true)}
        onAddCampaign={() => {
          setEditingCampaign(null);
          setCampaignInfluencerId(detailCreator?.id ?? null);
          setCampaignOpen(true);
        }}
        onEditCampaign={(campaign) => { setEditingCampaign(campaign); setCampaignOpen(true); }}
        onChanged={refreshAndUpdateDetail}
      />
      <div className="h-12" />
    </div>
  );
};

const DashboardBodySkeleton = () => (
  <div className="space-y-6 px-6 py-6">
    <Skeleton className="h-11 bg-card" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 bg-card" />)}
    </div>
    <Skeleton className="h-80 bg-card" />
    <Skeleton className="h-96 bg-card" />
  </div>
);

export default Dashboard;
