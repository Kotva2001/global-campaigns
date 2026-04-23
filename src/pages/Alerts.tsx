import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import {
  Plus, Pencil, Trash2, Eye, TrendingUp, DollarSign, BellPlus, Bell, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Metric = "views" | "spend" | "revenue" | "roi";
type Condition = "gt" | "lt";

const METRIC_LABEL: Record<Metric, string> = {
  views: "Views",
  spend: "Spend",
  revenue: "Revenue",
  roi: "ROI",
};

const CONDITION_LABEL: Record<Condition, string> = { gt: "greater than", lt: "less than" };

interface Rule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number | string;
  applies_to: string | null;
  is_active: boolean | null;
}

interface Alert {
  id: string;
  campaign_id: string | null;
  alert_type: string;
  title: string;
  message: string | null;
  is_read: boolean | null;
  created_at: string;
}

interface InfluencerLite { id: string; name: string; country: string; }

const ICONS: Record<string, typeof Eye> = {
  views_milestone: Eye,
  engagement_spike: TrendingUp,
  revenue_update: DollarSign,
  new_detection: BellPlus,
};
const ICON_COLORS: Record<string, string> = {
  views_milestone: "text-info",
  engagement_spike: "text-warning",
  revenue_update: "text-success",
  new_detection: "text-primary",
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  views_milestone: "Views Milestone",
  new_detection: "New Detection",
  revenue_update: "Revenue Update",
  engagement_spike: "Engagement Spike",
};

const notifyAlertsChanged = () => window.dispatchEvent(new Event("alerts:changed"));

const ruleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  metric: z.enum(["views", "spend", "revenue", "roi"]),
  condition: z.enum(["gt", "lt"]),
  threshold: z.number().finite("Must be a number"),
  applies_to: z.string().min(1),
  is_active: z.boolean(),
});
type RuleForm = {
  name: string;
  metric: Metric;
  condition: Condition;
  threshold: number;
  applies_to: string;
  is_active: boolean;
};

const Alerts = () => {
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <h1 className="text-lg font-bold tracking-tight">Alerts</h1>
        <p className="text-xs text-muted-foreground">Threshold-based notifications</p>
      </header>

      <div className="px-6 py-6">
        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="rules" className="mt-4"><RulesTab /></TabsContent>
          <TabsContent value="history" className="mt-4"><HistoryTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// ---------- Rules ----------

const RulesTab = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Rule | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r, error: e1 }, { data: inf, error: e2 }] = await Promise.all([
      supabase.from("alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("influencers").select("id, name, country").order("name"),
    ]);
    if (e1) toast.error(e1.message);
    if (e2) toast.error(e2.message);
    setRules((r ?? []) as Rule[]);
    setInfluencers((inf ?? []) as InfluencerLite[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const toggleActive = async (rule: Rule, v: boolean) => {
    setRules((prev) => prev.map((x) => x.id === rule.id ? { ...x, is_active: v } : x));
    const { error } = await supabase.from("alert_rules").update({ is_active: v }).eq("id", rule.id);
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const remove = async (rule: Rule) => {
    const { error } = await supabase.from("alert_rules").delete().eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Rule deleted");
    setConfirmDelete(null);
    void load();
  };

  const describe = (r: Rule) => {
    const metric = METRIC_LABEL[r.metric as Metric] ?? r.metric;
    const cond = CONDITION_LABEL[r.condition as Condition] ?? r.condition;
    return `${metric} ${cond} ${formatNumber(Number(r.threshold))}`;
  };

  const appliesLabel = (r: Rule) => {
    const t = r.applies_to ?? "all";
    if (t === "all") return "All influencers";
    if (t.startsWith("country:")) {
      const c = t.split(":")[1];
      return `${COUNTRY_FLAGS[c] ?? "🏳️"} ${COUNTRY_NAMES[c] ?? c}`;
    }
    if (t.startsWith("influencer:")) {
      const id = t.split(":")[1];
      return influencers.find((i) => i.id === id)?.name ?? "Influencer";
    }
    return t;
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rules.length} rule{rules.length === 1 ? "" : "s"}</div>
        <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 bg-card" />)}
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40 p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-2 text-sm font-medium">No rules yet</div>
          <div className="text-xs text-muted-foreground">Create a rule to start tracking thresholds.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rules.map((r) => (
            <Card key={r.id} className="border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold">{r.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{describe(r)}</div>
                  <div className="mt-1 text-xs">
                    Applies to: <span className="text-foreground">{appliesLabel(r)}</span>
                  </div>
                </div>
                <Switch checked={!!r.is_active} onCheckedChange={(v) => toggleActive(r, v)} />
              </div>
              <div className="mt-3 flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(r)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        influencers={influencers}
        onSaved={() => { setDialogOpen(false); void load(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>This will remove "{confirmDelete?.name}" permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const RuleFormDialog = ({
  open, onOpenChange, editing, influencers, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Rule | null;
  influencers: InfluencerLite[];
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<RuleForm>({
    name: "", metric: "views", condition: "gt", threshold: 0, applies_to: "all", is_active: true,
  });
  const [scope, setScope] = useState<"all" | "country" | "influencer">("all");
  const [scopeValue, setScopeValue] = useState<string>("");
  const [errors, setErrors] = useState<Partial<Record<keyof RuleForm, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      const t = editing.applies_to ?? "all";
      const s: "all" | "country" | "influencer" = t.startsWith("country:") ? "country" : t.startsWith("influencer:") ? "influencer" : "all";
      setScope(s);
      setScopeValue(s === "all" ? "" : t.split(":")[1] ?? "");
      setForm({
        name: editing.name,
        metric: editing.metric as Metric,
        condition: editing.condition as Condition,
        threshold: Number(editing.threshold),
        applies_to: t,
        is_active: !!editing.is_active,
      });
    } else {
      setScope("all"); setScopeValue("");
      setForm({ name: "", metric: "views", condition: "gt", threshold: 0, applies_to: "all", is_active: true });
    }
  }, [open, editing]);

  const submit = async () => {
    const applies_to = scope === "all" ? "all" : `${scope}:${scopeValue}`;
    if (scope !== "all" && !scopeValue) {
      setErrors({ applies_to: "Select a value" });
      return;
    }
    const parsed = ruleSchema.safeParse({ ...form, applies_to });
    if (!parsed.success) {
      const errs: Partial<Record<keyof RuleForm, string>> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof RuleForm;
        if (k && !errs[k]) errs[k] = i.message;
      }
      setErrors(errs);
      return;
    }
    setSaving(true);
    const payload: RuleForm = parsed.data as RuleForm;
    const { error } = editing
      ? await supabase.from("alert_rules").update(payload).eq("id", editing.id)
      : await supabase.from("alert_rules").insert([payload]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Rule updated" : "Rule created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit rule" : "Add rule"}</DialogTitle>
          <DialogDescription>Trigger an alert when a metric crosses a threshold.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Rule name" error={errors.name} required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Metric">
              <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v as Metric })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                    <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Condition">
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as Condition })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gt">Greater than</SelectItem>
                  <SelectItem value="lt">Less than</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Threshold" error={errors.threshold} required>
              <Input
                type="number"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Field label="Applies to" error={errors.applies_to}>
            <div className="flex gap-2">
              <Select value={scope} onValueChange={(v) => { setScope(v as typeof scope); setScopeValue(""); }}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All influencers</SelectItem>
                  <SelectItem value="country">Specific country</SelectItem>
                  <SelectItem value="influencer">Specific influencer</SelectItem>
                </SelectContent>
              </Select>
              {scope === "country" && (
                <Select value={scopeValue} onValueChange={setScopeValue}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {scope === "influencer" && (
                <Select value={scopeValue} onValueChange={setScopeValue}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select influencer" /></SelectTrigger>
                  <SelectContent>
                    {influencers.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{COUNTRY_FLAGS[i.country] ?? ""} {i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Field>

          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">Active</span>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create rule"}</Button>
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

// ---------- History ----------

const HistoryTab = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setAlerts((data ?? []) as Alert[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("alerts-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(
    () => filter === "All" ? alerts : alerts.filter((a) => a.alert_type === filter),
    [alerts, filter],
  );

  const markRead = async (a: Alert) => {
    if (a.is_read) return;
    setAlerts((prev) => prev.map((x) => x.id === a.id ? { ...x, is_read: true } : x));
    const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", a.id);
    if (error) {
      toast.error(error.message);
      void load();
    } else {
      notifyAlertsChanged();
    }
  };

  const markAll = async () => {
    const unread = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (unread.length === 0) return;
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    const { error } = await supabase.from("alerts").update({ is_read: true }).eq("is_read", false);
    if (error) {
      toast.error(error.message);
      void load();
    } else {
      notifyAlertsChanged();
      toast.success(`Marked ${unread.length} as read`);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All types</SelectItem>
            {Object.entries(ALERT_TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={markAll}>
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 bg-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40 p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-2 text-sm font-medium">No alerts yet</div>
          <div className="text-xs text-muted-foreground">Alerts you receive will appear here.</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const Icon = ICONS[a.alert_type] ?? Bell;
            const colorClass = ICON_COLORS[a.alert_type] ?? "text-muted-foreground";
            const unread = !a.is_read;
            return (
              <Card
                key={a.id}
                onClick={() => markRead(a)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 border-border bg-card p-4 transition-colors hover:bg-card-hover",
                  unread && "border-l-4 border-l-primary",
                )}
              >
                <div className="relative">
                  {unread && <span className="absolute -left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />}
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-muted/40", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn("truncate text-sm", unread ? "font-bold text-foreground" : "font-medium text-foreground")}>{a.title}</div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {a.message && <div className="mt-0.5 text-xs text-muted-foreground">{a.message}</div>}
                  <div className="mt-1 text-[11px] text-muted-foreground">Related: {a.campaign_id ? `Campaign ${a.campaign_id.slice(0, 8)}` : "No linked campaign"}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
};

export default Alerts;
