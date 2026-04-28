import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlatformFilter } from "@/hooks/useFilters";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  platform: PlatformFilter;
  setPlatform: (v: PlatformFilter) => void;
  hasActiveFilter: boolean;
  clear: () => void;
  resultCount: number;
}

const PLATFORMS: PlatformFilter[] = ["All", "YouTube", "Instagram", "YB Shorts", "Story"];

const platformActive: Record<string, string> = {
  All: "bg-[hsl(var(--glow-cyan))] text-[hsl(var(--background))] shadow-[0_0_12px_hsl(var(--glow-cyan)/0.55)]",
  YouTube: "bg-[hsl(var(--platform-youtube))] text-white shadow-[0_0_12px_hsl(var(--platform-youtube)/0.55)]",
  Instagram: "bg-[hsl(var(--platform-instagram))] text-white shadow-[0_0_12px_hsl(var(--platform-instagram)/0.55)]",
  "YB Shorts": "bg-[hsl(var(--platform-shorts))] text-white shadow-[0_0_12px_hsl(var(--platform-shorts)/0.55)]",
  Story: "bg-[hsl(var(--platform-story))] text-white shadow-[0_0_12px_hsl(var(--platform-story)/0.55)]",
};
const platformOutline: Record<string, string> = {
  All: "text-[hsl(var(--glow-cyan)/0.85)] hover:text-[hsl(var(--glow-cyan))]",
  YouTube: "text-[hsl(var(--platform-youtube)/0.85)] hover:text-[hsl(var(--platform-youtube))]",
  Instagram: "text-[hsl(var(--platform-instagram)/0.85)] hover:text-[hsl(var(--platform-instagram))]",
  "YB Shorts": "text-[hsl(var(--platform-shorts)/0.85)] hover:text-[hsl(var(--platform-shorts))]",
  Story: "text-[hsl(var(--platform-story)/0.85)] hover:text-[hsl(var(--platform-story))]",
};

export const FilterBar = ({
  search,
  setSearch,
  platform,
  setPlatform,
  hasActiveFilter,
  clear,
  resultCount,
}: Props) => (
  <div className="flex flex-wrap items-center gap-3 px-6 pt-8">
    <div className="relative min-w-[260px] flex-1 max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--glow-cyan)/0.65)]" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search influencer or campaign…"
        className="input-neon h-10 rounded-lg pl-9 text-sm text-foreground"
      />
    </div>

    <div
      className="flex flex-wrap items-center gap-1 rounded-lg p-1 backdrop-blur"
      style={{ background: "hsl(240 45% 9% / 0.6)", border: "1px solid hsl(var(--glow-cyan) / 0.18)" }}
    >
      {PLATFORMS.map((p) => (
        <button
          key={p}
          onClick={() => setPlatform(p)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150",
            platform === p
              ? platformActive[p]
              : cn("hover:bg-[hsl(var(--glow-purple)/0.10)]", platformOutline[p]),
          )}
        >
          {p}
        </button>
      ))}
    </div>

    {hasActiveFilter && (
      <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
        <X className="h-3.5 w-3.5" /> Clear
      </Button>
    )}

    <div className="ml-auto text-sm text-muted-foreground">
      <span className="font-semibold text-foreground tabular-nums">{resultCount}</span> result
      {resultCount === 1 ? "" : "s"}
    </div>
  </div>
);
