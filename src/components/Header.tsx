import { Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";

interface Props {
  selectedCountry: string;
  loading: boolean;
  lastFetched: Date | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export const Header = ({ selectedCountry, loading, lastFetched, onRefresh, onOpenSettings }: Props) => {
  const marketLabel =
    selectedCountry === "All"
      ? "🌍 All markets"
      : `${COUNTRY_FLAGS[selectedCountry] ?? ""} ${COUNTRY_NAMES[selectedCountry] ?? selectedCountry}`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Influencer ROI Tracker
            </h1>
            <p className="text-xs text-muted-foreground">regals.cz · multi-market dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium text-foreground">{marketLabel}</div>
            {lastFetched && (
              <div className="text-xs text-muted-foreground">
                Updated {lastFetched.toLocaleTimeString("cs-CZ")}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenSettings}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
