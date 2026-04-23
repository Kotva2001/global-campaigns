import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Bell,
  Radar,
  Settings as SettingsIcon,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Props {
  onOpenSettings: () => void;
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeKey: null as null | "alerts" | "scanner" },
  { to: "/creators", label: "Creators", icon: Users, badgeKey: null },
  { to: "/analytics", label: "Analytics", icon: BarChart3, badgeKey: null },
  { to: "/alerts", label: "Alerts", icon: Bell, badgeKey: "alerts" as const },
  { to: "/scanner", label: "Scanner", icon: Radar, badgeKey: "scanner" as const },
];

const useBadgeCounts = () => {
  const [alertsCount, setAlertsCount] = useState(0);
  const [scannerCount, setScannerCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ count: a }, { count: s }] = await Promise.all([
        supabase.from("alerts").select("*", { count: "exact", head: true }).eq("is_read", false),
        supabase.from("detected_videos").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setAlertsCount(a ?? 0);
      setScannerCount(s ?? 0);
    };
    void load();

    window.addEventListener("alerts:changed", load);

    const ch = supabase
      .channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "detected_videos" }, load)
      .subscribe();
    return () => {
      window.removeEventListener("alerts:changed", load);
      void supabase.removeChannel(ch);
    };
  }, []);

  return { alerts: alertsCount, scanner: scannerCount };
};

const SidebarContent = ({ onOpenSettings, onNavigate }: Props & { onNavigate?: () => void }) => {
  const counts = useBadgeCounts();
  const location = useLocation();

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-foreground">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">Influencer ROI Tracker</div>
            <div className="truncate text-xs text-muted-foreground">regals.cz</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          const badge =
            item.badgeKey === "alerts"
              ? counts.alerts
              : item.badgeKey === "scanner"
                ? counts.scanner
                : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    item.badgeKey === "alerts"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => {
            onOpenSettings();
            onNavigate?.();
          }}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
};

export const AppSidebar = ({ onOpenSettings }: Props) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-[240px] shrink-0 border-r border-border md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent onOpenSettings={onOpenSettings} />
        </div>
      </aside>

      {/* Mobile trigger */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] border-r border-border bg-zinc-950 p-0">
            <SidebarContent
              onOpenSettings={onOpenSettings}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-bold">Influencer ROI Tracker</span>
        </div>
      </div>
    </>
  );
};
