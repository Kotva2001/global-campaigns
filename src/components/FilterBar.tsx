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

export const FilterBar = ({
  search,
  setSearch,
  platform,
  setPlatform,
  hasActiveFilter,
  clear,
  resultCount,
}: Props) => (
  <div className="flex flex-wrap items-center gap-3 px-6 pt-6">
    <div className="relative min-w-[220px] flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search influencer or campaign…"
        className="border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground"
      />
    </div>

    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1">
      {PLATFORMS.map((p) => (
        <button
          key={p}
          onClick={() => setPlatform(p)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            platform === p
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
      <span className="font-semibold text-foreground">{resultCount}</span> result
      {resultCount === 1 ? "" : "s"}
    </div>
  </div>
);
