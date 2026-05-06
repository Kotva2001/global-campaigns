import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, X, User, Video, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { COUNTRY_FLAGS } from "@/lib/countries";
import { formatCompact, formatPercent } from "@/lib/formatters";
import { PerformanceScoreBadge } from "@/components/PerformanceScoreBadge";
import { useCreatorScores } from "@/hooks/useCreatorScores";

export type SearchScope = "all" | "campaigns";

interface CreatorHit { id: string; name: string; country: string; status: string | null; }
interface CampaignHit {
  id: string; campaign_name: string | null; platform: string; publish_date: string | null;
  views: number | null; engagement_rate: number | string | null; video_url: string | null;
  influencer_id: string | null; deal_id: string | null;
  influencer?: { id: string; name: string; country: string } | null;
  deal?: { id: string; products?: { name: string } | null } | null;
}
interface ProductHit { id: string; name: string; sku: string | null; }

interface Props {
  scope?: SearchScope;
  placeholder?: string;
  className?: string;
  onPickCreator?: (creatorId: string) => void;
  onPickCampaign?: (campaign: CampaignHit) => void;
}

export const GlobalSearch = ({
  scope = "all",
  placeholder = "Search creators, campaigns, products…",
  className,
  onPickCreator,
  onPickCampaign,
}: Props) => {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<CreatorHit[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignHit[]>([]);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const debounced = useDebouncedValue(value.trim(), 250);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { scores } = useCreatorScores();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (debounced.length < 2) {
      setCreators([]); setCampaigns([]); setProducts([]); setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const like = `%${debounced.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const run = async () => {
      const [campaignRes, creatorRes, productRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id,campaign_name,platform,publish_date,views,engagement_rate,video_url,influencer_id,deal_id")
          .or(`campaign_name.ilike.${like},video_url.ilike.${like}`)
          .order("publish_date", { ascending: false, nullsFirst: false })
          .limit(15),
        scope === "all"
          ? supabase.from("influencers").select("id,name,country,status").or(`name.ilike.${like},contact_person.ilike.${like}`).order("name").limit(8)
          : Promise.resolve({ data: [] as CreatorHit[], error: null }),
        scope === "all"
          ? supabase.from("products").select("id,name,sku").or(`name.ilike.${like},sku.ilike.${like}`).order("name").limit(8)
          : Promise.resolve({ data: [] as ProductHit[], error: null }),
      ]);
      if (cancelled) return;

      let campaignRows: CampaignHit[] = (campaignRes.data ?? []) as CampaignHit[];
      const inflIds = [...new Set(campaignRows.map((r) => r.influencer_id).filter(Boolean) as string[])];
      const dealIds = [...new Set(campaignRows.map((r) => r.deal_id).filter(Boolean) as string[])];
      const [inflRes, dealRes] = await Promise.all([
        inflIds.length ? supabase.from("influencers").select("id,name,country").in("id", inflIds) : Promise.resolve({ data: [] as any[] }),
        dealIds.length ? supabase.from("deals").select("id, products(name)").in("id", dealIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const inflMap = new Map(((inflRes.data ?? []) as any[]).map((x) => [x.id, x]));
      const dealMap = new Map(((dealRes.data ?? []) as any[]).map((x) => [x.id, x]));
      campaignRows = campaignRows.map((r) => ({
        ...r,
        influencer: r.influencer_id ? (inflMap.get(r.influencer_id) as any) ?? null : null,
        deal: r.deal_id ? (dealMap.get(r.deal_id) as any) ?? null : null,
      }));
      setCampaigns(campaignRows);
      setCreators(((creatorRes.data ?? []) as CreatorHit[]));
      setProducts(((productRes.data ?? []) as ProductHit[]));
      setLoading(false);
    };
    void run();
    return () => { cancelled = true; };
  }, [debounced, scope]);

  const total = creators.length + campaigns.length + products.length;
  const hasQuery = debounced.length >= 2;

  const goToCreator = (id: string) => {
    setOpen(false);
    if (onPickCreator) return onPickCreator(id);
    navigate(`/creators?focus=${id}`);
  };
  const pickCampaign = (c: CampaignHit) => {
    setOpen(false);
    if (onPickCampaign) return onPickCampaign(c);
    if (c.influencer_id) navigate(`/creators?focus=${c.influencer_id}`);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--glow-cyan)/0.65)]" />
      <Input
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="input-neon h-10 rounded-lg pl-9 pr-9 text-sm"
      />
      {value && (
        <button
          onClick={() => { setValue(""); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && hasQuery && (
        <div
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg shadow-[0_0_32px_hsl(var(--glow-purple)/0.35)]"
          style={{
            background: "hsl(240 45% 8% / 0.98)",
            border: "1px solid hsl(var(--glow-cyan) / 0.30)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="max-h-[480px] overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            )}
            {!loading && total === 0 && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">No results.</div>
            )}

            {creators.length > 0 && (
              <SectionHeader icon={<User className="h-3 w-3" />} label="Creators" count={creators.length} color="hsl(var(--glow-cyan))" />
            )}
            {creators.map((c) => (
              <button
                key={c.id}
                onClick={() => goToCreator(c.id)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[hsl(var(--glow-cyan)/0.08)]"
              >
                <span className="text-base">{COUNTRY_FLAGS[c.country] ?? "🏳️"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.country}{c.status ? ` · ${c.status}` : ""}</div>
                </div>
                <PerformanceScoreBadge score={scores.get(c.id)?.score ?? null} size="sm" />
              </button>
            ))}

            {campaigns.length > 0 && (
              <SectionHeader icon={<Video className="h-3 w-3" />} label="Campaigns" count={campaigns.length} color="hsl(var(--glow-pink))" />
            )}
            {campaigns.map((c) => {
              const productName = c.deal?.products?.name;
              return (
                <button
                  key={c.id}
                  onClick={() => pickCampaign(c)}
                  className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-[hsl(var(--glow-pink)/0.08)]"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase"
                    style={{
                      background: "hsl(240 40% 12%)",
                      border: "1px solid hsl(var(--glow-pink) / 0.5)",
                      color: "hsl(var(--glow-pink))",
                    }}
                  >
                    {(c.influencer?.name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {c.campaign_name || <span className="text-muted-foreground">— Untitled —</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                      {c.influencer ? (
                        <span>{COUNTRY_FLAGS[c.influencer.country] ?? ""} {c.influencer.name}</span>
                      ) : null}
                      <span>· {c.platform}</span>
                      {c.publish_date && <span>· {c.publish_date}</span>}
                      {c.views != null && <span>· {formatCompact(c.views)} views</span>}
                      {c.engagement_rate != null && <span>· {formatPercent(Number(c.engagement_rate))}</span>}
                      {productName && <span>· 📦 {productName}</span>}
                    </div>
                  </div>
                </button>
              );
            })}

            {products.length > 0 && (
              <SectionHeader icon={<Package className="h-3 w-3" />} label="Products" count={products.length} color="hsl(var(--glow-purple))" />
            )}
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => { setOpen(false); navigate(`/products?focus=${p.id}`); }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[hsl(var(--glow-purple)/0.08)]"
              >
                <Package className="h-4 w-4 text-[hsl(var(--glow-purple))]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
                  {p.sku && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SKU {p.sku}</div>}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            Type at least 2 characters · Server-side search
          </div>
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) => (
  <div
    className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider"
    style={{ color, background: "hsl(240 40% 6% / 0.6)", borderTop: "1px solid hsl(var(--border))" }}
  >
    {icon} {label}
    <span className="ml-auto text-muted-foreground/70">{count}</span>
  </div>
);