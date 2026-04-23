import { Globe2 } from "lucide-react";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { formatCompact } from "@/lib/formatters";
import type { MarketStats } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface Props {
  selected: string;
  onSelect: (country: string) => void;
  stats: Map<string, MarketStats>;
  totalInfluencers: number;
  totalCampaigns: number;
  totalViews: number;
}

export const MarketSelector = ({
  selected,
  onSelect,
  stats,
  totalInfluencers,
  totalCampaigns,
  totalViews,
}: Props) => {
  return (
    <div className="px-6 pt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Markets
        </h2>
        <span className="text-xs text-muted-foreground">{COUNTRIES.length} countries</span>
      </div>
      <div className="no-scrollbar flex flex-wrap gap-3 overflow-x-auto pb-3">
        <MarketCard
          active={selected === "All"}
          onClick={() => onSelect("All")}
          flag={<Globe2 className="h-6 w-6 text-primary" />}
          code="ALL"
          name="All markets"
          influencers={totalInfluencers}
          campaigns={totalCampaigns}
          views={totalViews}
        />
        {COUNTRIES.map((c) => {
          const s = stats.get(c);
          return (
            <MarketCard
              key={c}
              active={selected === c}
              onClick={() => onSelect(c)}
              flag={<span className="text-3xl leading-none">{COUNTRY_FLAGS[c]}</span>}
              code={c}
              name={COUNTRY_NAMES[c]}
              influencers={s?.influencers ?? 0}
              campaigns={s?.campaigns ?? 0}
              views={s?.views ?? 0}
            />
          );
        })}
      </div>
    </div>
  );
};

interface CardProps {
  active: boolean;
  onClick: () => void;
  flag: React.ReactNode;
  code: string;
  name: string;
  influencers: number;
  campaigns: number;
  views: number;
}

const MarketCard = ({ active, onClick, flag, code, name, influencers, campaigns, views }: CardProps) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex min-w-[170px] shrink-0 flex-col items-start gap-2 overflow-hidden rounded-xl border bg-card p-4 text-left transition-all",
      active
        ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_8px_24px_-12px_hsl(var(--primary)/0.5)]"
        : "border-border hover:border-muted-foreground/40 hover:bg-card-hover",
    )}
  >
    {active && (
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
    )}
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">{flag}</div>
      <span className={cn("text-xs font-bold tracking-wider", active ? "text-primary" : "text-muted-foreground")}>
        {code}
      </span>
    </div>
    <div className="text-sm font-semibold text-foreground">{name}</div>
    <div className="grid w-full grid-cols-3 gap-1 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      <div>
        <div className="text-sm font-bold text-foreground">{influencers}</div>
        <div>infl.</div>
      </div>
      <div>
        <div className="text-sm font-bold text-foreground">{campaigns}</div>
        <div>camp.</div>
      </div>
      <div>
        <div className="text-sm font-bold text-foreground">{formatCompact(views)}</div>
        <div>views</div>
      </div>
    </div>
  </button>
);
