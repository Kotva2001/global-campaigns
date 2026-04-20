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
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { COUNTRY_FLAGS } from "@/lib/countries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CampaignEntry } from "@/types/campaign";

interface Props {
  rows: CampaignEntry[];
}

const platformBadge = (p: string) => {
  const cls =
    p === "YouTube"
      ? "bg-[hsl(var(--platform-youtube)/0.15)] text-[hsl(var(--platform-youtube))]"
      : p === "Instagram"
        ? "bg-[hsl(var(--platform-instagram)/0.15)] text-[hsl(var(--platform-instagram))]"
        : "bg-[hsl(var(--platform-shorts)/0.15)] text-[hsl(var(--platform-shorts))]";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{p}</span>;
};

const collabBadge = (c: string) => {
  const v = c.toLowerCase();
  const cls = v.includes("paid")
    ? "bg-[hsl(var(--collab-paid)/0.15)] text-[hsl(var(--collab-paid))]"
    : v.includes("barter")
      ? "bg-[hsl(var(--collab-barter)/0.15)] text-[hsl(var(--collab-barter))]"
      : "bg-muted text-muted-foreground";
  return c ? (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{c}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
};

const csvEscape = (v: unknown) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportCsv = (rows: CampaignEntry[]) => {
  const headers = [
    "Country", "Influencer", "Campaign", "Platform", "Date", "Collab", "Cost",
    "Views", "Likes", "Comments", "Sessions", "Engagement %", "Revenue", "Conversion %",
  ];
  const body = rows.map((r) =>
    [
      r.country, r.influencer, r.campaignName, r.platform, r.publishDate, r.collaborationType,
      r.campaignCost ?? "", r.views ?? "", r.likes ?? "", r.comments ?? "",
      r.sessions ?? "", r.engagementRate ?? "", r.purchaseRevenue ?? "", r.conversionRate ?? "",
    ].map(csvEscape).join(","),
  );
  const csv = [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `influencer-roi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

export const DataTable = ({ rows }: Props) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: "views", desc: true }]);

  const columns = useMemo<ColumnDef<CampaignEntry>[]>(
    () => [
      {
        id: "country",
        header: "Market",
        accessorKey: "country",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="mr-1">{COUNTRY_FLAGS[row.original.country]}</span>
            <span className="text-xs font-semibold text-muted-foreground">{row.original.country}</span>
          </span>
        ),
      },
      {
        id: "influencer",
        header: "Influencer",
        accessorKey: "influencer",
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">{String(getValue() || "—")}</span>
        ),
      },
      {
        id: "campaign",
        header: "Campaign",
        accessorKey: "campaignName",
        cell: ({ getValue }) => (
          <span className="block max-w-[220px] truncate text-foreground/80">{String(getValue() || "—")}</span>
        ),
      },
      {
        id: "platform",
        header: "Platform",
        accessorKey: "platform",
        cell: ({ getValue }) => platformBadge(String(getValue())),
      },
      {
        id: "date",
        header: "Date",
        accessorKey: "publishDate",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">{String(getValue() || "—")}</span>
        ),
      },
      {
        id: "collab",
        header: "Collab",
        accessorKey: "collaborationType",
        cell: ({ getValue }) => collabBadge(String(getValue() || "")),
      },
      {
        id: "cost",
        header: () => <div className="text-right">Cost</div>,
        accessorKey: "campaignCost",
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums text-foreground">
            {formatCurrency(getValue() as number | null)}
          </div>
        ),
      },
      {
        id: "views",
        header: () => <div className="text-right">Views</div>,
        accessorKey: "views",
        cell: ({ getValue }) => (
          <div className="text-right font-bold tabular-nums text-foreground">
            {formatNumber(getValue() as number | null)}
          </div>
        ),
      },
      {
        id: "likes",
        header: () => <div className="text-right">Likes</div>,
        accessorKey: "likes",
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums text-muted-foreground">
            {formatNumber(getValue() as number | null)}
          </div>
        ),
      },
      {
        id: "sessions",
        header: () => <div className="text-right">Sessions</div>,
        accessorKey: "sessions",
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return (
            <div className={cn("text-right tabular-nums", v ? "text-success" : "text-muted-foreground")}>
              {formatNumber(v)}
            </div>
          );
        },
      },
      {
        id: "engagement",
        header: () => <div className="text-right">Engagement</div>,
        accessorKey: "engagementRate",
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return (
            <div className={cn("text-right tabular-nums", v ? "text-success" : "text-muted-foreground")}>
              {formatPercent(v)}
            </div>
          );
        },
      },
      {
        id: "revenue",
        header: () => <div className="text-right">Revenue</div>,
        accessorKey: "purchaseRevenue",
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return (
            <div className={cn("text-right tabular-nums", v && v > 0 ? "font-bold text-success" : "text-muted-foreground")}>
              {formatCurrency(v)}
            </div>
          );
        },
      },
      {
        id: "conversion",
        header: () => <div className="text-right">Conv. %</div>,
        accessorKey: "conversionRate",
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return (
            <div className={cn("text-right tabular-nums", v ? "text-success" : "text-muted-foreground")}>
              {formatPercent(v)}
            </div>
          );
        },
      },
    ],
    [],
  );

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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          All Campaigns
        </h2>
        <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportCsv(rows)}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        onClick={h.column.getToggleSortingHandler()}
                        className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/60 transition-colors hover:bg-card-hover"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center text-sm text-muted-foreground">
                    No campaigns to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <div>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {rows.length}{" "}
              row{rows.length === 1 ? "" : "s"}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
