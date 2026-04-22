import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { COUNTRIES, COUNTRY_FLAGS } from "@/lib/countries";
import { extractYouTubeVideoId } from "@/lib/youtube";
import type { CampaignEntry, InfluencerRecord, Platform } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PLATFORMS: Platform[] = ["YouTube", "Instagram", "YB Shorts", "TikTok", "Other"];
const COLLAB_TYPES = ["Barter", "Paid", "Gifted", "Affiliate", "Other"];

const numeric = z.union([z.number(), z.literal("")]).nullable();
const campaignSchema = z.object({
  influencerId: z.string().min(1, "Influencer is required"),
  campaignName: z.string().trim().max(240).optional(),
  platform: z.enum(["YouTube", "Instagram", "YB Shorts", "TikTok", "Other"]),
  publishDate: z.date(),
  videoLink: z.string().trim().max(1000).optional(),
  collaborationType: z.string().trim().max(80).optional(),
  campaignCost: numeric,
  utmLink: z.string().trim().max(1000).optional(),
  managedBy: z.string().trim().max(160).optional(),
  views: numeric,
  likes: numeric,
  comments: numeric,
  sessions: numeric,
  engagementRate: numeric,
  purchaseRevenue: numeric,
  conversionRate: numeric,
});

type CampaignValues = z.infer<typeof campaignSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: CampaignEntry | null;
  initialInfluencerId?: string | null;
  onSaved: () => void;
}

const toInputNumber = (value: number | null | undefined) => value ?? "";
const toDbNumber = (value: number | "" | null | undefined) => value === "" || value == null ? null : Number(value);
const isoDate = (date: Date) => format(date, "yyyy-MM-dd");

const parseDisplayDate = (value: string | null | undefined) => {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const CampaignDialog = ({ open, onOpenChange, editing, initialInfluencerId, onSaved }: Props) => {
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [values, setValues] = useState<CampaignValues>({
    influencerId: "",
    campaignName: "",
    platform: "YouTube",
    publishDate: new Date(),
    videoLink: "",
    collaborationType: "Barter",
    campaignCost: 0,
    utmLink: "",
    managedBy: "",
    views: "",
    likes: "",
    comments: "",
    sessions: "",
    engagementRate: "",
    purchaseRevenue: "",
    conversionRate: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [creatorName, setCreatorName] = useState("");

  useEffect(() => {
    if (!open) return;
    void supabase.from("influencers").select("*").order("country").order("name").then(({ data, error }) => {
      if (error) toast.error(error.message);
      setInfluencers((data ?? []) as InfluencerRecord[]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setValues({
      influencerId: editing?.influencerId ?? initialInfluencerId ?? "",
      campaignName: editing?.campaignName ?? "",
      platform: editing?.platform ?? "YouTube",
      publishDate: parseDisplayDate(editing?.publishDateIso ?? editing?.publishDate),
      videoLink: editing?.videoLink ?? "",
      collaborationType: editing?.collaborationType || "Barter",
      campaignCost: toInputNumber(editing?.campaignCost ?? 0),
      utmLink: editing?.utmLink ?? "",
      managedBy: editing?.managedBy ?? "",
      views: toInputNumber(editing?.views),
      likes: toInputNumber(editing?.likes),
      comments: toInputNumber(editing?.comments),
      sessions: toInputNumber(editing?.sessions),
      engagementRate: toInputNumber(editing?.engagementRate),
      purchaseRevenue: toInputNumber(editing?.purchaseRevenue),
      conversionRate: toInputNumber(editing?.conversionRate),
    });
    setErrors({});
    setStatsOpen(!!editing);
  }, [editing, initialInfluencerId, open]);

  const grouped = useMemo(() => COUNTRIES.map((country) => ({ country, rows: influencers.filter((influencer) => influencer.country === country) })).filter((group) => group.rows.length), [influencers]);

  const submit = async () => {
    const parsed = campaignSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof CampaignValues, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof CampaignValues] ||= issue.message;
      setErrors(next);
      return;
    }

    const value = parsed.data;
    const payload = {
      influencer_id: value.influencerId,
      campaign_name: value.campaignName || null,
      platform: value.platform,
      publish_date: isoDate(value.publishDate),
      video_url: value.videoLink || null,
      video_id: extractYouTubeVideoId(value.videoLink ?? ""),
      collaboration_type: value.collaborationType || null,
      campaign_cost: toDbNumber(value.campaignCost) ?? 0,
      utm_link: value.utmLink || null,
      managed_by: value.managedBy || null,
      views: toDbNumber(value.views) ?? 0,
      likes: toDbNumber(value.likes) ?? 0,
      comments: toDbNumber(value.comments) ?? 0,
      sessions: toDbNumber(value.sessions) ?? 0,
      engagement_rate: toDbNumber(value.engagementRate),
      purchase_revenue: toDbNumber(value.purchaseRevenue) ?? 0,
      conversion_rate: toDbNumber(value.conversionRate),
    };

    setSaving(true);
    const result = editing
      ? await supabase.from("campaigns").update(payload).eq("id", editing.id)
      : await supabase.from("campaigns").insert(payload);
    setSaving(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(editing ? "Campaign updated" : "Campaign added");
    onSaved();
  };

  const createCreatorFirst = () => {
    toast.message("Create the influencer on the Creators page first, then add their campaign.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit campaign" : "Add campaign"}</DialogTitle>
          <DialogDescription>Campaign details, collaboration setup, links, and manual performance stats.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <Field label="Influencer" error={errors.influencerId} required className="sm:col-span-2">
            <div className="flex gap-2">
              <Select value={values.influencerId} onValueChange={(influencerId) => setValues({ ...values, influencerId })}>
                <SelectTrigger><SelectValue placeholder="Select influencer" /></SelectTrigger>
                <SelectContent>
                  {grouped.map((group) => (
                    <div key={group.country}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{COUNTRY_FLAGS[group.country]} {group.country}</div>
                      {group.rows.map((influencer) => <SelectItem key={influencer.id} value={influencer.id}>{influencer.name} ({influencer.country})</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={createCreatorFirst}><Plus className="h-4 w-4" /> New</Button>
            </div>
          </Field>

          <Field label="Campaign/Product Name" className="sm:col-span-2"><Input value={values.campaignName} onChange={(event) => setValues({ ...values, campaignName: event.target.value })} maxLength={240} /></Field>

          <Field label="Platform" required>
            <Select value={values.platform} onValueChange={(platform) => setValues({ ...values, platform: platform as Platform })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PLATFORMS.map((platform) => <SelectItem key={platform} value={platform}>{platform}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          <Field label="Publish Date" required>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start gap-2 text-left font-normal", !values.publishDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4" /> {format(values.publishDate, "dd.MM.yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={values.publishDate} onSelect={(date) => date && setValues({ ...values, publishDate: date })} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </Field>

          <Field label="Video/Post URL" className="sm:col-span-2"><Input value={values.videoLink} onChange={(event) => setValues({ ...values, videoLink: event.target.value })} maxLength={1000} /></Field>

          <Field label="Collaboration Type">
            <Select value={values.collaborationType} onValueChange={(collaborationType) => setValues({ ...values, collaborationType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COLLAB_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          {values.collaborationType === "Paid" && <NumberField label="Campaign Cost" value={values.campaignCost} onChange={(campaignCost) => setValues({ ...values, campaignCost })} />}

          <Field label="UTM Link"><Input value={values.utmLink} onChange={(event) => setValues({ ...values, utmLink: event.target.value })} maxLength={1000} /></Field>
          <Field label="Managed By"><Input value={values.managedBy} onChange={(event) => setValues({ ...values, managedBy: event.target.value })} maxLength={160} /></Field>
        </div>

        <Collapsible open={statsOpen} onOpenChange={setStatsOpen} className="rounded-md border border-border p-3">
          <CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between px-1">Stats section <span>{statsOpen ? "−" : "+"}</span></Button></CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">
            <NumberField label="Views" value={values.views} onChange={(views) => setValues({ ...values, views })} />
            <NumberField label="Likes" value={values.likes} onChange={(likes) => setValues({ ...values, likes })} />
            <NumberField label="Comments" value={values.comments} onChange={(comments) => setValues({ ...values, comments })} />
            <NumberField label="Sessions" value={values.sessions} onChange={(sessions) => setValues({ ...values, sessions })} />
            <NumberField label="Engagement Rate" value={values.engagementRate} onChange={(engagementRate) => setValues({ ...values, engagementRate })} step="0.01" />
            <NumberField label="Revenue" value={values.purchaseRevenue} onChange={(purchaseRevenue) => setValues({ ...values, purchaseRevenue })} />
            <NumberField label="Conversion Rate" value={values.conversionRate} onChange={(conversionRate) => setValues({ ...values, conversionRate })} step="0.01" />
          </CollapsibleContent>
        </Collapsible>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add campaign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, error, required, className, children }: { label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const NumberField = ({ label, value, onChange, step = "1" }: { label: string; value: number | "" | null; onChange: (value: number | "") => void; step?: string }) => (
  <Field label={label}>
    <Input type="number" min="0" step={step} value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} />
  </Field>
);
