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
    <div
      className="relative flex h-full w-full flex-col text-foreground"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,240,255,0.03) 0%, transparent 40%, rgba(180,50,255,0.05) 100%), #06061a",
      }}
    >
      {/* Vertical line texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 30px)",
        }}
      />
      {/* Right edge gradient border */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,240,255,0.15), rgba(180,77,255,0.15))",
        }}
      />

      <div className="relative px-4 py-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00f0ff] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]" />
          </span>
          <div className="min-w-0">
            <div
              className="truncate font-bold tracking-tight"
              style={{
                fontSize: "16px",
                fontWeight: 700,
                background: "linear-gradient(90deg, #00f0ff, #ff2d95)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Influencer ROI Tracker
            </div>
            <div
              className="truncate font-medium"
              style={{
                fontSize: "12px",
                color: "#00f0ff",
                textShadow: "0 0 6px rgba(0,240,255,0.6)",
              }}
            >
              regals.cz
            </div>
          </div>
        </div>
        {/* Header divider */}
        <div
          className="mt-4 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,240,255,0.5), transparent)",
          }}
        />
      </div>

      <nav className="relative flex-1 space-y-1 px-3 py-2">
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
                "sidebar-nav-item group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
                active && "sidebar-nav-item-active",
              )}
              style={{ height: "44px", paddingLeft: "12px", paddingRight: "12px" }}
            >
              <Icon className="sidebar-nav-icon shrink-0" style={{ width: 20, height: 20 }} />
              <span className="sidebar-nav-label flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-white",
                    item.badgeKey === "alerts"
                      ? "animate-pulse"
                      : "",
                  )}
                  style={
                    item.badgeKey === "alerts"
                      ? { background: "#ff2d95", boxShadow: "0 0 8px rgba(255,45,149,0.6)" }
                      : { background: "#b44dff", boxShadow: "0 0 8px rgba(180,77,255,0.5)" }
                  }
                >
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Group divider */}
      <div
        className="relative mx-3 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(180,100,255,0.2), transparent)",
        }}
      />

      <div className="relative px-3 py-3">
        <Button
          variant="ghost"
          className="sidebar-nav-item w-full justify-start gap-3 rounded-lg font-medium"
          style={{ height: "40px", paddingLeft: "12px", fontSize: "13px" }}
          onClick={() => {
            onOpenSettings();
            onNavigate?.();
          }}
        >
          <SettingsIcon className="sidebar-nav-icon shrink-0" style={{ width: 18, height: 18 }} />
          <span className="sidebar-nav-label">Settings</span>
        </Button>
        <Button
          variant="ghost"
          className="sidebar-nav-item sidebar-nav-item-danger mt-1 w-full justify-start gap-3 rounded-lg font-medium"
          style={{ height: "40px", paddingLeft: "12px", fontSize: "13px" }}
          onClick={async () => {
            await supabase.auth.signOut();
            onNavigate?.();
          }}
        >
          <LogOut className="sidebar-nav-icon shrink-0" style={{ width: 18, height: 18 }} />
          <span className="sidebar-nav-label">Logout</span>
        </Button>
      </div>

      {/* Synthwave sun decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: "80px",
          height: "40px",
          background:
            "radial-gradient(ellipse at center bottom, rgba(255,45,149,0.18), rgba(180,77,255,0.12) 60%, transparent 80%)",
          borderTopLeftRadius: "40px",
          borderTopRightRadius: "40px",
          opacity: 0.8,
        }}
      />
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
