import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { linkCampaignToDeal } from "@/lib/deals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  campaignId: string;
  influencerId: string | null;
  dealId: string | null;
  onChanged?: () => void;
}

interface DealOption {
  id: string;
  label: string;
}

export const DealCell = ({ campaignId, influencerId, dealId, onChanged }: Props) => {
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !influencerId) return;
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

  const current = deals.find((d) => d.id === dealId);

  const onChange = async (next: string) => {
    const target = next === "__none__" ? null : next;
    if (target === dealId) return;
    try {
      await linkCampaignToDeal(campaignId, target, dealId);
      onChanged?.();
    } catch (e) {
      toastError("Could not link deal", e);
    }
  };

  if (!influencerId) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Select open={open} onOpenChange={setOpen} value={dealId ?? "__none__"} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-auto min-w-[80px] max-w-[180px] border-none bg-transparent px-2 py-0 text-xs shadow-none hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
        <SelectValue>
          {dealId ? (
            <span className="inline-flex items-center gap-1 truncate text-foreground">
              <Link2 className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{current?.label.split(" · ")[0] ?? "Deal"}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[280px]">
        <SelectItem value="__none__">— No deal —</SelectItem>
        {deals.map((d) => (
          <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
        ))}
        {deals.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No deals yet for this influencer.</div>}
      </SelectContent>
    </Select>
  );
};
