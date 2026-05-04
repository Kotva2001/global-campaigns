import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ArrowRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { COUNTRY_FLAGS } from "@/lib/countries";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { useCreatorScores } from "@/hooks/useCreatorScores";
import { PerformanceScoreBadge } from "@/components/PerformanceScoreBadge";
import { cn } from "@/lib/utils";

interface InfluencerRow {
  id: string;
  name: string;
  country: string;
}

const RANK_STYLE = (rank: number) => {
  if (rank === 1) return { color: "hsl(48 100% 60%)", label: "Gold" };
  if (rank === 2) return { color: "hsl(0 0% 80%)", label: "Silver" };
  if (rank === 3) return { color: "hsl(28 70% 55%)", label: "Bronze" };
  return { color: "hsl(var(--muted-foreground))", label: "" };
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  if (!values.length || values.every((v) => v === 0)) {
    return <div className="h-6 w-[80px] text-[10px] text-muted-foreground/40">no trend</div>;
  }
  const w = 80;
  const h = 24;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
};

export const CreatorLeaderboard = () => {
  const navigate = useNavigate();
  const { scores, loading: scoresLoading } = useCreatorScores();
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [loadingInfs, setLoadingInfs] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void supabase.from("influencers").select("id,name,country").then(({ data }) => {
      if (cancelled) return;
      setInfluencers((data ?? []) as InfluencerRow[]);
      setLoadingInfs(false);
    });
    return () => { cancelled = true; };
  }, []);

  const top = useMemo(() => {
    const byId = new Map(influencers.map((i) => [i.id, i]));
    return [...scores.values()]
      .filter((s) => byId.has(s.creatorId))
      .sort((a, b) => b.score - a.score || b.totalViews - a.totalViews)
      .slice(0, 10)
      .map((s) => ({ ...s, info: byId.get(s.creatorId)! }));
  }, [scores, influencers]);

  const loading = scoresLoading || loadingInfs;

  return (
    <TooltipProvider>
      <div className="px-6 pt-6">
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.4)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[hsl(48_100%_60%)]" style={{ filter: "drop-shadow(0 0 6px hsl(48 100% 60% / 0.7))" }} />
              <h2 className="bg-gradient-to-r from-primary via-[hsl(var(--platform-instagram))] to-primary bg-clip-text text-base font-bold uppercase tracking-wider text-transparent">
                Creator Leaderboard
              </h2>
              <span className="text-xs text-muted-foreground">· Top 10 by Performance Score</span>
            </div>
            <Button variant="ghost" size="sm" className="text-[hsl(var(--glow-cyan))] hover:bg-[hsl(var(--glow-cyan)/0.12)]" onClick={() => navigate("/creators?sort=score")}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 bg-muted/30" />)}
            </div>
          ) : top.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No creators with campaign data yet.</div>
          ) : (
            <div className="space-y-2">
              {top.map((row, idx) => {
                const rank = idx + 1;
                const rankMeta = RANK_STYLE(rank);
                const isPodium = rank <= 3;
                return (
                  <div
                    key={row.creatorId}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2 transition-all hover:border-primary/40",
                    )}
                    style={isPodium ? {
                      borderColor: rankMeta.color.replace(")", " / 0.55)").replace("hsl(", "hsla("),
                      boxShadow: `0 0 16px -6px ${rankMeta.color}, inset 3px 0 0 ${rankMeta.color}`,
                      background: `linear-gradient(90deg, ${rankMeta.color.replace(")", " / 0.07)").replace("hsl(", "hsla(")}, transparent 60%), hsl(var(--background) / 0.4)`,
                    } : undefined}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums"
                      style={{
                        color: rankMeta.color,
                        textShadow: `0 0 8px ${rankMeta.color}`,
                        background: isPodium ? `${rankMeta.color.replace(")", " / 0.12)").replace("hsl(", "hsla(")}` : "transparent",
                        border: isPodium ? `1px solid ${rankMeta.color.replace(")", " / 0.5)").replace("hsl(", "hsla(")}` : "1px solid hsl(var(--border))",
                      }}
                    >
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </div>

                    <Avatar className="h-9 w-9 shrink-0 border border-primary/40">
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {initials(row.info.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-bold">
                        {row.info.name}
                        <span className="text-xs">{COUNTRY_FLAGS[row.info.country] ?? "🏳️"}</span>
                      </div>
                      <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                        {row.info.country} · {row.posts} post{row.posts === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="hidden min-w-[110px] text-right md:block">
                      <div className="text-sm font-bold tabular-nums" style={{ color: "hsl(var(--glow-cyan))" }}>
                        {formatNumber(row.totalViews)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">views</div>
                    </div>

                    <div className="hidden min-w-[80px] text-right sm:block">
                      <div className="text-sm font-bold tabular-nums" style={{ color: "hsl(var(--platform-instagram))" }}>
                        {row.avgEngagement == null ? "—" : formatPercent(row.avgEngagement)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">engagement</div>
                    </div>

                    <div className="hidden lg:block">
                      <Sparkline values={row.monthlyViews.map((m) => m.views)} color="hsl(var(--glow-cyan))" />
                    </div>

                    <PerformanceScoreBadge score={row.score} size="md" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default CreatorLeaderboard;