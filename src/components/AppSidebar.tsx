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
  ChevronRight,
  DoorOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Props {
  onOpenSettings: () => void;
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey: null | "alerts" | "scanner";
  accent: string;
  description: string;
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeKey: null, accent: "#00f0ff", description: "Overview & KPIs" },
  { to: "/creators", label: "Creators", icon: Users, badgeKey: null, accent: "#ff2d95", description: "Influencer roster" },
  { to: "/products", label: "Products", icon: Package, badgeKey: null, accent: "#ff6b2b", description: "Product catalog" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, badgeKey: null, accent: "#b44dff", description: "Charts & insights" },
  { to: "/alerts", label: "Alerts", icon: Bell, badgeKey: "alerts", accent: "#ff3366", description: "Threshold rules" },
  { to: "/scanner", label: "Scanner", icon: Radar, badgeKey: "scanner", accent: "#39ff14", description: "Brand mentions" },
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

const useTickerStats = () => {
  const [stats, setStats] = useState<{ creators: number; campaigns: number }>({ creators: 0, campaigns: 0 });
  useEffect(() => {
    const load = async () => {
      const [{ count: c }, { count: k }] = await Promise.all([
        supabase.from("creators").select("*", { count: "exact", head: true }),
        supabase.from("campaigns").select("*", { count: "exact", head: true }),
      ]);
      setStats({ creators: c ?? 0, campaigns: k ?? 0 });
    };
    void load().catch(() => {});
  }, []);
  return stats;
};

const SidebarContent = ({ onOpenSettings, onNavigate }: Props & { onNavigate?: () => void }) => {
  const counts = useBadgeCounts();
  const ticker = useTickerStats();
  const location = useLocation();

  return (
    <div
      className="relative flex h-full w-full flex-col text-foreground overflow-hidden"
      style={{ background: "#06061a" }}
    >
      {/* Nebula blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 45%, rgba(180,77,255,0.10), rgba(255,45,149,0.06) 40%, transparent 70%)",
        }}
      />
      {/* Vertical line texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 30px)",
        }}
      />
      {/* Right edge gradient border */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,240,255,0.25), rgba(180,77,255,0.25))",
        }}
      />

      {/* Header / Hero */}
      <div className="relative px-4" style={{ paddingTop: 24, paddingBottom: 16 }}>
        <div className="flex items-center gap-3">
          <span className="relative flex" style={{ width: 12, height: 12 }}>
            <span className="sidebar-pulse-dot absolute inset-0 rounded-full" />
            <span
              className="relative inline-flex rounded-full"
              style={{ width: 12, height: 12, background: "#00f0ff", boxShadow: "0 0 12px #00f0ff" }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="truncate"
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #00f0ff, #ff2d95)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.15,
              }}
            >
              Influencer ROI Tracker
            </div>
            <div
              className="truncate font-medium"
              style={{ fontSize: 13, color: "#00f0ff", textShadow: "0 0 6px rgba(0,240,255,0.6)" }}
            >
              regals.cz
            </div>
          </div>
        </div>

        {/* Stats ticker */}
        <div
          className="mt-2 truncate"
          style={{ fontSize: 11, color: "#7777a0", letterSpacing: "0.02em" }}
        >
          <span className="tabular-nums">{ticker.creators}</span> creators · <span className="tabular-nums">{ticker.campaigns}</span> campaigns
        </div>

        {/* Decorative divider */}
        <div
          className="mt-4 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #00f0ff 30%, #ff2d95 70%, transparent)",
            boxShadow: "0 0 8px rgba(0,240,255,0.3)",
            opacity: 0.7,
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-3 space-y-2">
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
                "sb-item group relative flex items-center gap-3 rounded-lg text-sm transition-all duration-150",
                active && "sb-item-active",
              )}
              style={
                {
                  height: 48,
                  paddingLeft: 12,
                  paddingRight: 12,
                  ["--accent" as any]: item.accent,
                } as React.CSSProperties
              }
            >
              {/* Color dot */}
              <span
                className="sb-dot shrink-0 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: item.accent,
                  boxShadow: `0 0 6px ${item.accent}`,
                }}
              />
              <Icon className="sb-icon shrink-0" style={{ width: 20, height: 20 }} />
              <span className="sb-label flex-1 font-medium">{item.label}</span>

              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-white",
                    item.badgeKey === "alerts" && "sb-badge-shake",
                    item.badgeKey === "scanner" && "sb-badge-pulse",
                  )}
                  style={
                    item.badgeKey === "alerts"
                      ? { background: "#ff2d95", boxShadow: "0 0 10px rgba(255,45,149,0.7)" }
                      : { background: "#39ff14", color: "#06061a", boxShadow: "0 0 10px rgba(57,255,20,0.7)" }
                  }
                >
                  {badge}
                </span>
              )}

              {active && (
                <ChevronRight
                  className="sb-arrow shrink-0"
                  style={{ width: 14, height: 14, color: item.accent, filter: `drop-shadow(0 0 4px ${item.accent})` }}
                />
              )}

              {/* Tooltip */}
              <span className="sb-tooltip" role="tooltip">
                <span className="sb-tooltip-title">{item.label}</span>
                <span className="sb-tooltip-desc">{item.description}</span>
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom group divider — thicker gradient */}
      <div
        className="relative mx-3"
        style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, #00f0ff, #b44dff, transparent)",
          opacity: 0.5,
          borderRadius: 2,
        }}
      />

      <div className="relative px-3 py-3">
        <Button
          variant="ghost"
          className="sb-item sb-item-settings w-full justify-start gap-3 rounded-lg font-medium"
          style={{ height: 40, paddingLeft: 12, fontSize: 13 }}
          onClick={() => {
            onOpenSettings();
            onNavigate?.();
          }}
        >
          <SettingsIcon className="sb-icon sb-icon-spin shrink-0" style={{ width: 18, height: 18 }} />
          <span className="sb-label">Settings</span>
        </Button>
        <Button
          variant="ghost"
          className="sb-item sb-item-danger mt-1 w-full justify-start gap-3 rounded-lg font-medium"
          style={{ height: 40, paddingLeft: 12, fontSize: 13 }}
          onClick={async () => {
            await supabase.auth.signOut();
            onNavigate?.();
          }}
        >
          <DoorOpen className="sb-icon shrink-0" style={{ width: 18, height: 18 }} />
          <span className="sb-label">Logout</span>
        </Button>
      </div>

      {/* Synthwave sun + reflection */}
      <div
        aria-hidden
        className="pointer-events-none relative mx-auto"
        style={{ width: 60, height: 40, marginBottom: 8 }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 12,
            width: 60,
            height: 30,
            background: "linear-gradient(180deg, #ff2d95, #b44dff)",
            opacity: 0.18,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            boxShadow: "0 0 20px rgba(255,45,149,0.25)",
          }}
        />
        {/* reflection lines */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 8, width: 50, height: 1, background: "#ff2d95", opacity: 0.18 }} />
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 4, width: 40, height: 1, background: "#b44dff", opacity: 0.12 }} />
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 1, width: 30, height: 1, background: "#b44dff", opacity: 0.07 }} />
      </div>
    </div>
  );
};

export const AppSidebar = ({ onOpenSettings }: Props) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border md:block">
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
          <SheetContent side="left" className="w-[260px] border-r border-border bg-zinc-950 p-0">
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
