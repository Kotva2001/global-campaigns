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
  LogOut,
  Package,
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
  { to: "/products", label: "Products", icon: Package, badgeKey: null },
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
    <div className="flex h-full w-full flex-col bg-sidebar text-foreground">
      <div className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <div className="gradient-text truncate text-sm font-bold tracking-tight">Influencer ROI Tracker</div>
            <div className="truncate text-[11px] text-muted-foreground">regals.cz</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
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
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary/10 text-foreground shadow-[inset_3px_0_0_hsl(var(--primary)),0_0_18px_-6px_hsl(var(--primary)/0.5)]"
                  : "text-muted-foreground hover:bg-[hsl(var(--glow-purple)/0.10)] hover:text-foreground hover:shadow-[0_0_14px_-6px_hsl(var(--glow-purple)/0.6)]",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums",
                    item.badgeKey === "alerts"
                      ? "bg-[hsl(var(--platform-instagram))] text-white shadow-[0_0_10px_hsl(var(--platform-instagram)/0.55)]"
                      : "bg-[hsl(var(--platform-story))] text-white shadow-[0_0_10px_hsl(var(--platform-story)/0.55)]",
                  )}
                >
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          onClick={() => {
            onOpenSettings();
            onNavigate?.();
          }}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start gap-3 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            onNavigate?.();
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
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
