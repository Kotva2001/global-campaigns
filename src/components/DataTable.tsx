import { useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Edit3, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COUNTRY_FLAGS } from "@/lib/countries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CampaignEntry } from "@/types/campaign";

interface Props {
  rows: CampaignEntry[];
  onChanged?: () => void;
  onAddCampaign?: () => void;
  onEditCampaign?: (campaign: CampaignEntry) => void;
}

const COLLAB_TYPES = ["Barter", "Paid", "Gifted", "Affiliate", "Other"];

const platformBadge = (platform: string) => {
  const cls = platform === "YouTube"
    ? "bg-[hsl(var(--platform-youtube)/0.15)] text-[hsl(var(--platform-youtube))]"
    : platform === "Instagram"
      ? "bg-[hsl(var(--platform-instagram)/0.15)] text-[hsl(var(--platform-instagram))]"
      : "bg-[hsl(var(--platform-shorts)/0.15)] text-[hsl(var(--platform-shorts))]";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{platform}</span>;
};

const collabBadge = (collab: string) => {
  const v = collab.toLowerCase();
  const cls = v.includes("paid")
    ? "bg-[hsl(var(--collab-paid)/0.15)] text-[hsl(var(--collab-paid))]"
    : v.includes("barter")
      ? "bg-[hsl(var(--collab-barter)/0.15)] text-[hsl(var(--collab-barter))]"
      : "bg-muted text-muted-foreground";
  return collab ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{collab}</span> : <span className="text-muted-foreground">—</span>;
};

const csvEscape = (value: unknown) => {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const exportCsv = (rows: CampaignEntry[]) => {
  const headers = ["Country", "Influencer", "Campaign", "Platform", "Date", "Collab", "Cost", "Views", "Likes", "Comments", "Sessions", "Engagement %", "Revenue", "Conversion %"];
  const body = rows.map((row) => [
    row.country, row.influencer, row.campaignName, row.platform, row.publishDate, row.collaborationType,
    row.campaignCost ?? "", row.views ?? "", row.likes ?? "", row.comments ?? "", row.sessions ?? "",
    row.engagementRate ?? "", row.purchaseRevenue ?? "", row.conversionRate ?? "",
  ].map(csvEscape).join(","));
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `influencer-roi-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const EditableNumber = ({ value, campaignId, field, onChanged }: { value: number | null; campaignId: string; field: "views" | "likes" | "comments"; onChanged?: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));
  const save = async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a valid number");
      return;
    }
    const { error } = await supabase.from("campaigns").update({ [field]: next }).eq("id", campaignId);
    if (error) return toast.error(error.message);
    setEditing(false);
    toast.success("Stat updated");
    onChanged?.();
  };

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        min="0"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setEditing(false);
        }}
        className="h-8 w-24 text-right"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="group ml-auto flex items-center gap-1 tabular-nums text-muted-foreground hover:text-foreground">
      {formatNumber(value)} <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
};

export const DataTable = ({ rows, onChanged, onAddCampaign, onEditCampaign }: Props) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: "views", desc: true }]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deleteCampaign, setDeleteCampaign] = useState<CampaignEntry | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCollab, setBulkCollab] = useState("");

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, checked]) => checked).map(([id]) => id), [selected]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);

  const deleteOne = async () => {
    if (!deleteCampaign) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", deleteCampaign.id);
    if (error) return toast.error(error.message);
    toast.success("Campaign deleted");
    setDeleteCampaign(null);
    onChanged?.();
  };

  const deleteSelected = async () => {
    const { error } = await supabase.from("campaigns").delete().in("id", selectedIds);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${selectedIds.length} campaigns`);
    setSelected({});
    setBulkDeleteOpen(false);
    onChanged?.();
  };

  const bulkUpdateCollab = async (collaborationType: string) => {
    setBulkCollab(collaborationType);
    const { error } = await supabase.from("campaigns").update({ collaboration_type: collaborationType }).in("id", selectedIds);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${selectedIds.length} campaigns`);
    setSelected({});
    setBulkCollab("");
    onChanged?.();
  };

  const columns = useMemo<ColumnDef<CampaignEntry>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getRowModel().rows.length > 0 && table.getRowModel().rows.every((row) => selected[row.original.id])}
          onCheckedChange={(checked) => {
            const next = { ...selected };
            table.getRowModel().rows.forEach((row) => { next[row.original.id] = !!checked; });
            setSelected(next);
          }}
        />
      ),
      cell: ({ row }) => <Checkbox checked={!!selected[row.original.id]} onCheckedChange={(checked) => setSelected((current) => ({ ...current, [row.original.id]: !!checked }))} />,
      enableSorting: false,
    },
    { id: "country", header: "Market", accessorKey: "country", cell: ({ row }) => <span className="whitespace-nowrap"><span className="mr-1">{COUNTRY_FLAGS[row.original.country]}</span><span className="text-xs font-semibold text-muted-foreground">{row.original.country}</span></span> },
    { id: "influencer", header: "Influencer", accessorKey: "influencer", cell: ({ getValue }) => <span className="font-semibold text-foreground">{String(getValue() || "—")}</span> },
    { id: "campaign", header: "Campaign", accessorKey: "campaignName", cell: ({ getValue }) => <span className="block max-w-[220px] truncate text-foreground/80">{String(getValue() || "—")}</span> },
    { id: "platform", header: "Platform", accessorKey: "platform", cell: ({ getValue }) => platformBadge(String(getValue())) },
    { id: "date", header: "Date", accessorKey: "publishDate", cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{String(getValue() || "—")}</span> },
    { id: "collab", header: "Collab", accessorKey: "collaborationType", cell: ({ getValue }) => collabBadge(String(getValue() || "")) },
    { id: "cost", header: () => <div className="text-right">Cost</div>, accessorKey: "campaignCost", cell: ({ getValue }) => <div className="text-right tabular-nums text-foreground">{formatCurrency(getValue() as number | null)}</div> },
    { id: "views", header: () => <div className="text-right">Views</div>, accessorKey: "views", cell: ({ row, getValue }) => <div className="text-right font-bold"><EditableNumber value={getValue() as number | null} campaignId={row.original.id} field="views" onChanged={onChanged} /></div> },
    { id: "likes", header: () => <div className="text-right">Likes</div>, accessorKey: "likes", cell: ({ row, getValue }) => <div className="text-right"><EditableNumber value={getValue() as number | null} campaignId={row.original.id} field="likes" onChanged={onChanged} /></div> },
    { id: "comments", header: () => <div className="text-right">Comments</div>, accessorKey: "comments", cell: ({ row, getValue }) => <div className="text-right"><EditableNumber value={getValue() as number | null} campaignId={row.original.id} field="comments" onChanged={onChanged} /></div> },
    { id: "sessions", header: () => <div className="text-right">Sessions</div>, accessorKey: "sessions", cell: ({ getValue }) => <div className="text-right tabular-nums text-muted-foreground">{formatNumber(getValue() as number | null)}</div> },
    { id: "engagement", header: () => <div className="text-right">Engagement</div>, accessorKey: "engagementRate", cell: ({ getValue }) => <div className="text-right tabular-nums text-muted-foreground">{formatPercent(getValue() as number | null)}</div> },
    { id: "revenue", header: () => <div className="text-right">Revenue</div>, accessorKey: "purchaseRevenue", cell: ({ getValue }) => <div className={cn("text-right tabular-nums", (getValue() as number | null) ? "font-bold text-success" : "text-muted-foreground")}>{formatCurrency(getValue() as number | null)}</div> },
    { id: "conversion", header: () => <div className="text-right">Conv. %</div>, accessorKey: "conversionRate", cell: ({ getValue }) => <div className="text-right tabular-nums text-muted-foreground">{formatPercent(getValue() as number | null)}</div> },
    { id: "actions", header: "", cell: ({ row }) => <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditCampaign?.(row.original)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteCampaign(row.original)}><Trash2 className="h-4 w-4" /></Button></div>, enableSorting: false },
  ], [onChanged, onEditCampaign, selected]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="px-6 pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Campaigns</h2>
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="gap-2" onClick={onAddCampaign}><Plus className="h-4 w-4" /> Add</Button>
          <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportCsv(rows)}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()} className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />)}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 transition-colors hover:bg-card-hover">
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="whitespace-nowrap px-3 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={columns.length} className="p-12 text-center text-sm text-muted-foreground">No campaigns to show.</td></tr>}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"><div>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {rows.length} row{rows.length === 1 ? "" : "s"}</div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button></div></div>}
      </Card>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>Delete selected ({selectedIds.length})</Button>
          <Select value={bulkCollab} onValueChange={bulkUpdateCollab}><SelectTrigger className="w-[210px]"><SelectValue placeholder="Update collaboration type" /></SelectTrigger><SelectContent>{COLLAB_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
          <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportCsv(selectedRows)}><Download className="h-4 w-4" /> Export selected</Button>
        </div>
      )}

      <AlertDialog open={!!deleteCampaign} onOpenChange={(open) => !open && setDeleteCampaign(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this campaign?</AlertDialogTitle><AlertDialogDescription>Delete this campaign by {deleteCampaign?.influencer} for {deleteCampaign?.campaignName || "—"} on {deleteCampaign?.publishDate || "—"}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteOne}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete selected campaigns?</AlertDialogTitle><AlertDialogDescription>This permanently deletes {selectedIds.length} campaign{selectedIds.length === 1 ? "" : "s"}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteSelected}>Delete selected</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
