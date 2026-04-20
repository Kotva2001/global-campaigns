import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SheetConfig } from "@/hooks/useSheetData";

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
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle>Google Sheets configuration</DialogTitle>
          <DialogDescription>
            Stored locally in your browser. Used to fetch all 11 country tabs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sheetId">Spreadsheet ID</Label>
            <Input
              id="sheetId"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1AbCdEfGhIjKlMnOp…"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              From the URL: <code>docs.google.com/spreadsheets/d/<b>SHEET_ID</b>/edit</code>
            </p>
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
            <p className="text-xs text-muted-foreground">
              Restrict this key to the Sheets API and your domain in Google Cloud Console.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!sheetId || !apiKey}>Save & fetch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
