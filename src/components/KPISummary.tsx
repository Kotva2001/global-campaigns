import { Activity, Eye, Wallet, TrendingUp, Percent, DollarSign, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { KPISet } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";

interface Props {
  kpis: KPISet;
  currency?: string;
  convertedSub?: string;
  onSelectMetric?: (metric: "campaigns" | "stories" | "totalViews" | "totalSpend" | "totalRevenue" | "roi" | "avgEngagement") => void;
}

export const KPISummary = ({ kpis, currency = "CZK", convertedSub, onSelectMetric }: Props) => {
  const roiPositive = (kpis.roi ?? 0) >= 0;
  return (
    <div className="grid grid-cols-2 gap-4 px-6 pt-8 md:grid-cols-3 xl:grid-cols-7">
      <KPI
        index={0}
        icon={<Activity className="h-4 w-4" />}
        label="Campaigns"
        valueNode={<CountUp value={kpis.campaigns} format={(n) => formatNumber(Math.round(n))} />}
        sub={`${kpis.influencers} influencers`}
        onClick={() => onSelectMetric?.("campaigns")}
      />
      <KPI
        index={1}
        icon={<Sparkles className="h-4 w-4" />}
        label="Stories"
        valueNode={<CountUp value={kpis.stories} format={(n) => formatNumber(Math.round(n))} />}
        sub="IG Stories logged"
        valueClass="text-[hsl(var(--platform-story))]"
        accent="story"
        onClick={() => onSelectMetric?.("stories")}
      />
      <KPI
        index={2}
        icon={<Eye className="h-4 w-4" />}
        label="Total Views"
        valueNode={<CountUp value={kpis.totalViews} format={(n) => formatNumber(Math.round(n))} />}
        sub={`${formatNumber(kpis.totalLikes)} likes`}
        onClick={() => onSelectMetric?.("totalViews")}
      />
      <KPI
        index={3}
        icon={<Wallet className="h-4 w-4" />}
        label="Total Spend"
        valueNode={<CountUp value={kpis.totalSpend} format={(n) => formatCurrency(n, currency)} />}
        sub={convertedSub}
        onClick={() => onSelectMetric?.("totalSpend")}
      />
      <KPI
        index={4}
        icon={<DollarSign className="h-4 w-4" />}
        label="Revenue"
        valueNode={<CountUp value={kpis.totalRevenue} format={(n) => formatCurrency(n, currency)} />}
        sub={convertedSub}
        valueClass={kpis.totalRevenue > 0 ? "text-success" : undefined}
        accent="success"
        onClick={() => onSelectMetric?.("totalRevenue")}
      />
      <KPI
        index={5}
        icon={<TrendingUp className="h-4 w-4" />}
        label="Overall ROI"
        value={kpis.roi == null ? "—" : `${kpis.roi >= 0 ? "+" : ""}${kpis.roi.toFixed(1)} %`}
        valueClass={
          kpis.roi == null ? undefined : roiPositive ? "text-success" : "text-destructive"
        }
        accent={kpis.roi == null ? undefined : roiPositive ? "success" : "destructive"}
        onClick={() => onSelectMetric?.("roi")}
      />
      <KPI
        index={6}
        icon={<Percent className="h-4 w-4" />}
        label="Avg Engagement"
        value={formatPercent(kpis.avgEngagement)}
        onClick={() => onSelectMetric?.("avgEngagement")}
      />
    </div>
  );
};

const KPI = ({
  icon,
  label,
  value,
  valueNode,
  sub,
  valueClass,
  onClick,
  index = 0,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  sub?: string;
  valueClass?: string;
  onClick?: () => void;
  index?: number;
  accent?: "success" | "destructive" | "story";
}) => {
  const accentColor =
    accent === "success"
      ? "hsl(var(--success))"
      : accent === "destructive"
        ? "hsl(var(--destructive))"
        : accent === "story"
          ? "hsl(var(--platform-story))"
          : "hsl(var(--primary))";
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        animationDelay: `${index * 50}ms`,
        backgroundImage: `linear-gradient(135deg, ${accentColor.replace("hsl(", "hsla(").replace(")", " / 0.04)")}, transparent 60%)`,
      }}
      className={cn(
        "glass-card relative overflow-hidden p-5 animate-fade-in-up",
        onClick && "cursor-pointer lift-hover focus:outline-none focus:ring-2 focus:ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="kpi-label">{label}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accentColor.replace("hsl(", "hsla(").replace(")", " / 0.12)")}`, color: accentColor }}
        >
          {icon}
        </span>
      </div>
      <div className={cn("kpi-number mt-3 text-foreground", valueClass)}>
        {valueNode ?? value}
      </div>
      {sub && <div className="mt-2 text-[11px] leading-snug text-muted-foreground">{sub}</div>}
    </Card>
  );
};
