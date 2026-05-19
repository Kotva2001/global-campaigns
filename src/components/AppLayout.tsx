import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useSheetData } from "@/hooks/useSheetData";
import { useIsAdmin } from "@/hooks/useUserRole";

export const AppLayout = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { config, updateConfig } = useSheetData();
  const isAdmin = useIsAdmin();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar onOpenSettings={() => isAdmin && setSettingsOpen(true)} />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
      {isAdmin && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          config={config}
          onSave={updateConfig}
        />
      )}
    </div>
  );
};
