import { Activity, Eye, Wallet, TrendingUp, Percent, DollarSign, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { KPISet } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface Props {
  kpis: KPISet;
  currency?: string;
  convertedSub?: string;
}

export const KPISummary = ({ kpis, currency = "CZK", convertedSub }: Props) => {
  const roiPositive = (kpis.roi ?? 0) >= 0;
  return (
    <div className="grid grid-cols-2 gap-3 px-6 pt-6 md:grid-cols-3 xl:grid-cols-7">
      <KPI
        icon={<Activity className="h-4 w-4" />}
        label="Campaigns"
        value={formatNumber(kpis.campaigns)}
        sub={`${kpis.influencers} influencers`}
      />
      <KPI
        icon={<Sparkles className="h-4 w-4" />}
        label="Stories"
        value={formatNumber(kpis.stories)}
        sub="IG Stories logged"
        valueClass="text-[hsl(var(--platform-story))]"
      />
      <KPI
        icon={<Eye className="h-4 w-4" />}
        label="Total Views"
        value={formatNumber(kpis.totalViews)}
        sub={`${formatNumber(kpis.totalLikes)} likes`}
      />
      <KPI
        icon={<Wallet className="h-4 w-4" />}
        label="Total Spend"
        value={formatCurrency(kpis.totalSpend, currency)}
        sub={convertedSub}
      />
      <KPI
        icon={<DollarSign className="h-4 w-4" />}
        label="Revenue"
        value={formatCurrency(kpis.totalRevenue, currency)}
        sub={convertedSub}
        valueClass={kpis.totalRevenue > 0 ? "text-success" : undefined}
      />
      <KPI
        icon={<TrendingUp className="h-4 w-4" />}
        label="Overall ROI"
        value={kpis.roi == null ? "—" : `${kpis.roi >= 0 ? "+" : ""}${kpis.roi.toFixed(1)} %`}
        valueClass={
          kpis.roi == null ? undefined : roiPositive ? "text-success" : "text-destructive"
        }
      />
      <KPI
        icon={<Percent className="h-4 w-4" />}
        label="Avg Engagement"
        value={formatPercent(kpis.avgEngagement)}
      />
    </div>
  );
};

const KPI = ({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) => (
  <Card className="border-border bg-card p-4 transition-colors hover:bg-card-hover">
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      <span className="text-primary/70">{icon}</span>
    </div>
    <div className={cn("mt-2 text-2xl font-bold tracking-tight text-foreground", valueClass)}>
      {value}
    </div>
    {sub && <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>}
  </Card>
);
