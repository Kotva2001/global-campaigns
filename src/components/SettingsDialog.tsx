import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SheetConfig } from "@/hooks/useSheetData";
import { ImportFromSheets } from "./ImportFromSheets";
import { DuplicateCleanup } from "./DuplicateCleanup";
import { ExchangeRateSettings } from "./ExchangeRateSettings";
import { UserManagement } from "./UserManagement";
import { AdminOnly, OwnerOnly, useIsOwner } from "@/hooks/useUserRole";
import { useAutoHide } from "@/hooks/useAutoHide";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: SheetConfig;
  onSave: (cfg: SheetConfig) => void;
}

export const SettingsDialog = ({ open, onOpenChange, config, onSave }: Props) => {
  const [sheetId, setSheetId] = useState(config.sheetId);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const isOwner = useIsOwner();
  const [showKey, setShowKey] = useAutoHide(10000);

  useEffect(() => {
    setSheetId(config.sheetId);
    setApiKey(config.apiKey);
  }, [config, open]);

  const submit = () => {
    onSave({ sheetId: sheetId.trim(), apiKey: apiKey.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your data source and one-time migration tools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <ExchangeRateSettings />

          <OwnerOnly>
            <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">API Keys & Secrets</h3>
                  <p className="text-xs text-muted-foreground">
                    Owner-only. Google Sheets credentials used to fetch all 11 country tabs. Hides automatically after 10 seconds.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Hide keys" : "Show keys"}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheetId">Spreadsheet ID</Label>
                <Input
                  id="sheetId"
                  value={showKey ? sheetId : (sheetId ? "••••••••••••••••" : "")}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="1AbCdEfGhIjKlMnOp…"
                  className="font-mono text-xs"
                  readOnly={!showKey}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">Google API key</Label>
                <Input
                  id="apiKey"
                  value={showKey ? apiKey : (apiKey ? "••••••••••••••••" : "")}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza…"
                  className="font-mono text-xs"
                  type={showKey ? "text" : "password"}
                  readOnly={!showKey}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={submit} disabled={!sheetId || !apiKey} size="sm">
                  Save & fetch
                </Button>
              </div>
            </div>
          </OwnerOnly>

          {isOwner && <ImportFromSheets />}
          <DuplicateCleanup />
          <AdminOnly>
            <UserManagement />
          </AdminOnly>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
