import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Search, Youtube, Instagram, MoreVertical, Pencil, PauseCircle, PlayCircle, Trash2, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { extractYouTubeChannelId } from "@/lib/youtube";
import { formatCompact, formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Status = "active" | "paused" | "ended";

interface Influencer {
  id: string;
  name: string;
  country: string;
  platforms: string[] | null;
  youtube_channel_id: string | null;
  youtube_channel_url: string | null;
  instagram_handle: string | null;
  contact_email: string | null;
  contact_person: string | null;
  notes: string | null;
  status: Status;
}

interface CampaignAgg {
  influencer_id: string;
  campaigns: number;
  totalViews: number;
  totalRevenue: number;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-success/15 text-success" },
  paused: { label: "Paused", cls: "bg-yellow-500/15 text-yellow-500" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  country: z.enum(COUNTRIES, { errorMap: () => ({ message: "Country is required" }) }),
  platforms: z.array(z.enum(["YouTube", "Instagram"])).default([]),
  youtube_channel_url: z.string().trim().max(500).optional().or(z.literal("")),
  instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  contact_email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["active", "paused", "ended"]),
});

type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  name: "", country: "CZ" as (typeof COUNTRIES)[number], platforms: [],
  youtube_channel_url: "", instagram_handle: "", contact_person: "",
  contact_email: "", notes: "", status: "active",
};

const Creators = () => {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [aggs, setAggs] = useState<Map<string, CampaignAgg>>(new Map());
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<string>("All");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<Influencer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Influencer | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: infl, error: e1 }, { data: camps, error: e2 }] = await Promise.all([
      supabase.from("influencers").select("*").order("name"),
      supabase.from("campaigns").select("influencer_id, views, purchase_revenue"),
    ]);
    if (e1) toast.error(`Failed to load creators: ${e1.message}`);
    if (e2) toast.error(`Failed to load stats: ${e2.message}`);
    setInfluencers((infl ?? []) as Influencer[]);
    const m = new Map<string, CampaignAgg>();
    for (const c of camps ?? []) {
      if (!c.influencer_id) continue;
      const cur = m.get(c.influencer_id) ?? { influencer_id: c.influencer_id, campaigns: 0, totalViews: 0, totalRevenue: 0 };
      cur.campaigns += 1;
      cur.totalViews += Number(c.views ?? 0);
      cur.totalRevenue += Number(c.purchase_revenue ?? 0);
      m.set(c.influencer_id, cur);
    }
    setAggs(m);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return influencers.filter((i) => {
      if (country !== "All" && i.country !== country) return false;
      if (status !== "All" && i.status !== status) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.contact_person ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [influencers, country, status, search]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (i: Influencer) => {
    setEditing(i);
    setDialogOpen(true);
  };

  const togglePause = async (i: Influencer) => {
    const next: Status = i.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("influencers").update({ status: next }).eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success(next === "paused" ? "Creator paused" : "Creator resumed");
    void load();
  };

  const deleteCreator = async (i: Influencer) => {
    const { error } = await supabase.from("influencers").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success("Creator deleted");
    setConfirmDelete(null);
    void load();
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Creators</h1>
            <p className="text-xs text-muted-foreground">Roster of influencers across markets</p>
          </div>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Creator
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto px-6 pb-3">
          <CountryTab active={country === "All"} onClick={() => setCountry("All")} flag="🌍" code="All" />
          {COUNTRIES.map((c) => (
            <CountryTab
              key={c}
              active={country === c}
              onClick={() => setCountry(c)}
              flag={COUNTRY_FLAGS[c]}
              code={c}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or contact…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} creator{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="px-6 py-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState country={country} onAdd={openCreate} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((i) => (
              <CreatorCard
                key={i.id}
                i={i}
                agg={aggs.get(i.id)}
                onEdit={() => openEdit(i)}
                onTogglePause={() => togglePause(i)}
                onDelete={() => setConfirmDelete(i)}
              />
            ))}
          </div>
        )}
      </div>

      <CreatorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false);
          void load();
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the creator and all their campaigns. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteCreator(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CountryTab = ({ active, onClick, flag, code }: { active: boolean; onClick: () => void; flag: string; code: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
      active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )}
  >
    <span>{flag}</span>
    <span className="font-medium">{code}</span>
  </button>
);

const EmptyState = ({ country, onAdd }: { country: string; onAdd: () => void }) => {
  const label = country === "All" ? "🌍 any market" : `${COUNTRY_FLAGS[country] ?? ""} ${COUNTRY_NAMES[country] ?? country}`;
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Card className="border-dashed border-border bg-card/40 p-10 text-center">
        <div className="text-3xl">🌱</div>
        <div className="mt-2 text-sm font-medium">No creators in {label} yet</div>
        <Button className="mt-4 gap-2" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Add your first creator
        </Button>
      </Card>
    </div>
  );
};

const CreatorCard = ({
  i, agg, onEdit, onTogglePause, onDelete,
}: {
  i: Influencer;
  agg: CampaignAgg | undefined;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}) => {
  const platforms = i.platforms ?? [];
  const meta = STATUS_META[i.status];
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold">{i.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{COUNTRY_FLAGS[i.country] ?? "🏳️"}</span>
            <span>{i.country}</span>
            <span>·</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>{meta.label}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePause}>
              {i.status === "active" ? (
                <><PauseCircle className="mr-2 h-4 w-4" /> Pause</>
              ) : (
                <><PlayCircle className="mr-2 h-4 w-4" /> Resume</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {platforms.includes("YouTube") && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--platform-youtube)/0.15)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--platform-youtube))]">
            <Youtube className="h-3 w-3" /> YouTube
          </span>
        )}
        {platforms.includes("Instagram") && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--platform-instagram)/0.15)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--platform-instagram))]">
            <Instagram className="h-3 w-3" /> Instagram
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs">
        {i.youtube_channel_url && (
          <a
            href={i.youtube_channel_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 truncate text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{i.youtube_channel_url.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {i.instagram_handle && (
          <a
            href={`https://instagram.com/${i.instagram_handle.replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Instagram className="h-3 w-3" />
            <span>@{i.instagram_handle.replace(/^@/, "")}</span>
          </a>
        )}
        {(i.contact_person || i.contact_email) && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {i.contact_person}
              {i.contact_person && i.contact_email ? " · " : ""}
              {i.contact_email}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
        <Stat label="Campaigns" value={String(agg?.campaigns ?? 0)} />
        <Stat label="Views" value={formatCompact(agg?.totalViews ?? 0)} />
        <Stat label="Revenue" value={formatCurrency(agg?.totalRevenue ?? 0)} valueClass={(agg?.totalRevenue ?? 0) > 0 ? "text-success" : undefined} />
      </div>
    </Card>
  );
};

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md bg-muted/40 p-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("text-sm font-bold", valueClass)}>{value}</div>
  </div>
);

const CreatorFormDialog = ({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Influencer | null;
  onSaved: () => void;
}) => {
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        name: editing.name,
        country: (editing.country as (typeof COUNTRIES)[number]) ?? "CZ",
        platforms: ((editing.platforms ?? []) as ("YouTube" | "Instagram")[]).filter((p) => p === "YouTube" || p === "Instagram"),
        youtube_channel_url: editing.youtube_channel_url ?? "",
        instagram_handle: editing.instagram_handle ?? "",
        contact_person: editing.contact_person ?? "",
        contact_email: editing.contact_email ?? "",
        notes: editing.notes ?? "",
        status: editing.status,
      });
    } else {
      setValues(emptyForm);
    }
    setErrors({});
  }, [open, editing]);

  const togglePlatform = (p: "YouTube" | "Instagram", checked: boolean) => {
    setValues((v) => ({
      ...v,
      platforms: checked ? Array.from(new Set([...v.platforms, p])) : v.platforms.filter((x) => x !== p),
    }));
  };

  const submit = async () => {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    const v = parsed.data;
    const ytUrl = v.platforms.includes("YouTube") ? (v.youtube_channel_url || "") : "";
    const igHandle = v.platforms.includes("Instagram")
      ? (v.instagram_handle || "").replace(/^@/, "")
      : "";

    const payload = {
      name: v.name,
      country: v.country,
      platforms: v.platforms,
      youtube_channel_url: ytUrl || null,
      youtube_channel_id: ytUrl ? extractYouTubeChannelId(ytUrl) : null,
      instagram_handle: igHandle || null,
      contact_person: v.contact_person || null,
      contact_email: v.contact_email || null,
      notes: v.notes || null,
      status: v.status,
    };

    setSaving(true);
    const { error } = editing
      ? await supabase.from("influencers").update(payload).eq("id", editing.id)
      : await supabase.from("influencers").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Creator updated" : "Creator added");
    onSaved();
  };

  const showYT = values.platforms.includes("YouTube");
  const showIG = values.platforms.includes("Instagram");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit creator" : "Add creator"}</DialogTitle>
          <DialogDescription>Influencer roster entry. Used for tracking and auto-detection.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Name" error={errors.name} required>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={120} />
          </Field>

          <Field label="Country" error={errors.country} required>
            <Select value={values.country} onValueChange={(v) => setValues({ ...values, country: v as (typeof COUNTRIES)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]} ({c})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Platforms">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showYT} onCheckedChange={(c) => togglePlatform("YouTube", !!c)} />
                YouTube
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showIG} onCheckedChange={(c) => togglePlatform("Instagram", !!c)} />
                Instagram
              </label>
            </div>
          </Field>

          {showYT && (
            <Field label="YouTube channel URL">
              <Input
                value={values.youtube_channel_url}
                onChange={(e) => setValues({ ...values, youtube_channel_url: e.target.value })}
                placeholder="https://www.youtube.com/channel/UCxxxx or /@handle"
                maxLength={500}
              />
            </Field>
          )}

          {showIG && (
            <Field label="Instagram handle">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <Input
                  value={values.instagram_handle.replace(/^@/, "")}
                  onChange={(e) => setValues({ ...values, instagram_handle: e.target.value.replace(/^@/, "") })}
                  className="pl-7"
                  maxLength={80}
                />
              </div>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Contact person">
              <Input value={values.contact_person} onChange={(e) => setValues({ ...values, contact_person: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Contact email" error={errors.contact_email}>
              <Input type="email" value={values.contact_email} onChange={(e) => setValues({ ...values, contact_email: e.target.value })} maxLength={255} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
              maxLength={2000}
              rows={3}
            />
          </Field>

          <Field label="Status">
            <RadioGroup
              value={values.status}
              onValueChange={(v) => setValues({ ...values, status: v as Status })}
              className="flex gap-4"
            >
              {(["active", "paused", "ended"] as Status[]).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm capitalize">
                  <RadioGroupItem value={s} /> {s}
                </label>
              ))}
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
    <Label className="text-xs">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

export default Creators;
