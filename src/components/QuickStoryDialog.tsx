import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { recalcDealSplit } from "@/lib/deals";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  influencerId: string;
  influencerName: string;
  onSaved: () => void;
}

interface DealOption {
  id: string;
  label: string;
}

export const QuickStoryDialog = ({ open, onOpenChange, influencerId, influencerName, onSaved }: Props) => {
  const [date, setDate] = useState<Date>(new Date());
  const [views, setViews] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [dealId, setDealId] = useState<string>("__none__");
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(new Date());
    setViews("");
    setName("");
    setDealId("__none__");
    void supabase
      .from("deals")
      .select("id,deal_name,total_cost,currency,products(name)")
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDeals((data ?? []).map((d: any) => ({
          id: d.id,
          label: `${d.deal_name || d.products?.name || "Untitled deal"} · ${Number(d.total_cost).toLocaleString("cs-CZ")} ${d.currency}`,
        })));
      });
  }, [open, influencerId]);

  const submit = async () => {
    setSaving(true);
    const isoDate = format(date, "yyyy-MM-dd");
    const linkedDealId = dealId === "__none__" ? null : dealId;
    const payload = {
      influencer_id: influencerId,
      campaign_name: name.trim() || `Story ${format(date, "dd.MM.yyyy")}`,
      platform: "Story",
      publish_date: isoDate,
      collaboration_type: linkedDealId ? "Paid" : "Barter",
      currency: "CZK" as const,
      campaign_cost: 0,
      views: views === "" ? 0 : Number(views),
      likes: 0,
      comments: 0,
      sessions: 0,
      purchase_revenue: 0,
      deal_id: linkedDealId,
    };
    const { error } = await supabase.from("campaigns").insert(payload);
    if (error) {
      setSaving(false);
      toastError("Could not log story", error);
      return;
    }
    if (linkedDealId) await recalcDealSplit(linkedDealId);
    setSaving(false);
    toast.success("Story logged");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-[hsl(var(--platform-story))]" /> Quick log story
          </DialogTitle>
          <DialogDescription>Log an Instagram Story for {influencerName}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Platform</Label>
            <div className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--platform-story)/0.18)] px-3 py-1 text-xs font-semibold text-[hsl(var(--platform-story))]">
              <Eye className="h-3 w-3" /> Story
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Story date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start gap-2 text-left font-normal")}>
                  <CalendarIcon className="h-4 w-4" /> {format(date, "dd.MM.yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Views / reach</Label>
            <Input type="number" min="0" value={views} onChange={(e) => setViews(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Deal (optional)</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No deal —</SelectItem>
                {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Campaign name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Story ${format(date, "dd.MM.yyyy")}`} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Log story"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};