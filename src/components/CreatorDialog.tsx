import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { parseInstagramHandles, formatInstagramHandles } from "@/lib/instagram";
import { extractYouTubeChannelId } from "@/lib/youtube";
import type { InfluencerRecord } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const creatorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  country: z.enum(COUNTRIES),
  platforms: z.array(z.enum(["YouTube", "Instagram"])),
  youtube_channel_url: z.string().trim().max(500).optional().or(z.literal("")),
  instagram_handle: z.string().trim().max(500).optional().or(z.literal("")),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  contact_email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["active", "paused", "ended"]),
});

type CreatorValues = z.infer<typeof creatorSchema>;

const emptyCreator: CreatorValues = {
  name: "",
  country: "CZ",
  platforms: [],
  youtube_channel_url: "",
  instagram_handle: "",
  contact_person: "",
  contact_email: "",
  notes: "",
  status: "active",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: InfluencerRecord | null;
  initialName?: string;
  onSaved: (creator?: InfluencerRecord) => void;
}

export const CreatorDialog = ({ open, onOpenChange, editing, initialName, onSaved }: Props) => {
  const [values, setValues] = useState<CreatorValues>(emptyCreator);
  const [errors, setErrors] = useState<Partial<Record<keyof CreatorValues, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        name: editing.name,
        country: (COUNTRIES.includes(editing.country as typeof COUNTRIES[number]) ? editing.country : "CZ") as typeof COUNTRIES[number],
        platforms: ((editing.platforms ?? []) as ("YouTube" | "Instagram")[]).filter((p) => p === "YouTube" || p === "Instagram"),
        youtube_channel_url: editing.youtube_channel_url ?? "",
        instagram_handle: formatInstagramHandles(editing.instagram_handle),
        contact_person: editing.contact_person ?? "",
        contact_email: editing.contact_email ?? "",
        notes: editing.notes ?? "",
        status: editing.status ?? "active",
      });
    } else {
      setValues({ ...emptyCreator, name: initialName ?? "" });
    }
    setErrors({});
  }, [editing, initialName, open]);

  const togglePlatform = (platform: "YouTube" | "Instagram", checked: boolean) => {
    setValues((current) => ({
      ...current,
      platforms: checked ? Array.from(new Set([...current.platforms, platform])) : current.platforms.filter((p) => p !== platform),
    }));
  };

  const submit = async () => {
    const parsed = creatorSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof CreatorValues, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof CreatorValues] ||= issue.message;
      setErrors(next);
      return;
    }

    const value = parsed.data;
    const youtubeUrl = value.platforms.includes("YouTube") ? value.youtube_channel_url || "" : "";
    const instagramHandles = value.platforms.includes("Instagram") ? parseInstagramHandles(value.instagram_handle || "") : [];
    const payload = {
      name: value.name,
      country: value.country,
      platforms: value.platforms,
      youtube_channel_url: youtubeUrl || null,
      youtube_channel_id: youtubeUrl ? extractYouTubeChannelId(youtubeUrl) : null,
      instagram_handle: instagramHandles.length ? instagramHandles : null,
      contact_person: value.contact_person || null,
      contact_email: value.contact_email || null,
      notes: value.notes || null,
      status: value.status,
    };

    setSaving(true);
    const result = editing
      ? await supabase.from("influencers").update(payload).eq("id", editing.id).select("*").single()
      : await supabase.from("influencers").insert(payload).select("*").single();
    setSaving(false);

    if (result.error) {
      toastError("Could not save creator", result.error);
      return;
    }
    toast.success(editing ? "Creator updated" : "Creator added");
    onSaved(result.data as InfluencerRecord);
  };

  const showYouTube = values.platforms.includes("YouTube");
  const showInstagram = values.platforms.includes("Instagram");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit creator" : "Add creator"}</DialogTitle>
          <DialogDescription>Manage creator profile, market, platforms, and contact details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Name" error={errors.name} required>
            <Input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} maxLength={120} />
          </Field>

          <Field label="Country" error={errors.country} required>
            <Select value={values.country} onValueChange={(country) => setValues({ ...values, country: country as typeof COUNTRIES[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>{COUNTRY_FLAGS[country]} {COUNTRY_NAMES[country]} ({country})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Platforms">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={showYouTube} onCheckedChange={(checked) => togglePlatform("YouTube", !!checked)} /> YouTube</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={showInstagram} onCheckedChange={(checked) => togglePlatform("Instagram", !!checked)} /> Instagram</label>
            </div>
          </Field>

          {showYouTube && <Field label="YouTube channel URL"><Input value={values.youtube_channel_url} onChange={(event) => setValues({ ...values, youtube_channel_url: event.target.value })} maxLength={500} /></Field>}
          {showInstagram && <Field label="Instagram handles"><Textarea value={values.instagram_handle} onChange={(event) => setValues({ ...values, instagram_handle: event.target.value })} rows={3} maxLength={500} placeholder="one handle per line or separated by commas" /></Field>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Contact person"><Input value={values.contact_person} onChange={(event) => setValues({ ...values, contact_person: event.target.value })} maxLength={120} /></Field>
            <Field label="Contact email" error={errors.contact_email}><Input type="email" value={values.contact_email} onChange={(event) => setValues({ ...values, contact_email: event.target.value })} maxLength={255} /></Field>
          </div>

          <Field label="Notes"><Textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} rows={3} maxLength={2000} /></Field>

          <Field label="Status">
            <RadioGroup value={values.status} onValueChange={(status) => setValues({ ...values, status: status as CreatorValues["status"] })} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="active" /> Active</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="paused" /> Paused</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="ended" /> Ended</label>
            </RadioGroup>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add creator"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);
