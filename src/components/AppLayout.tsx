import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthGate } from "@/components/AuthGate";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useSheetData } from "@/hooks/useSheetData";

export const AppLayout = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { config, updateConfig } = useSheetData();

  return (
    <AuthGate>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar onOpenSettings={() => setSettingsOpen(true)} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          config={config}
          onSave={updateConfig}
        />
      </div>
    </AuthGate>
  );
};
