import { useEffect, useState } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: SheetConfig;
  onSave: (cfg: SheetConfig) => void;
}

export const SettingsDialog = ({ open, onOpenChange, config, onSave }: Props) => {
  const [sheetId, setSheetId] = useState(config.sheetId);
  const [apiKey, setApiKey] = useState(config.apiKey);

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
          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="text-base font-semibold">Google Sheets configuration</h3>
              <p className="text-xs text-muted-foreground">
                Stored locally in your browser. Used to fetch all 11 country tabs.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sheetId">Spreadsheet ID</Label>
              <Input
                id="sheetId"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="1AbCdEfGhIjKlMnOp…"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">Google API key</Label>
              <Input
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza…"
                className="font-mono text-xs"
                type="password"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={submit} disabled={!sheetId || !apiKey} size="sm">
                Save & fetch
              </Button>
            </div>
          </div>

          <ImportFromSheets />
          <DuplicateCleanup />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
