import { useState, useMemo, ReactNode } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, MoreHorizontal, Loader2, LucideIcon } from "lucide-react";
import EmptyState from "./EmptyState";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  empty?: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: ReactNode;
  };
  onRowClick?: (row: T) => void;
  enableSelection?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  globalFilter?: string;
  /** Optional toolbar slot rendered above the table (filters, actions, etc) */
  toolbar?: ReactNode;
  /** Text when loading but no data yet */
  loadingLabel?: string;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  error,
  empty,
  onRowClick,
  enableSelection,
  onSelectionChange,
  globalFilter,
  toolbar,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const selectionColumn: ColumnDef<T, any> = useMemo(
    () => ({
      id: "__select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded border-border accent-primary"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded border-border accent-primary"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 32,
      enableSorting: false,
    }),
    [],
  );

  const finalColumns = useMemo(
    () => (enableSelection ? [selectionColumn, ...columns] : columns),
    [enableSelection, columns, selectionColumn],
  );

  const table = useReactTable({
    data,
    columns: finalColumns,
    state: {
      sorting,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
      if (onSelectionChange) {
        const selected = table.getRowModel().rows.filter((r) => next[r.id]).map((r) => r.original);
        onSelectionChange(selected);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const showEmpty = !loading && !error && rows.length === 0 && empty;

  return (
    <div>
      {toolbar}
      {error ? (
        <div className="py-12 text-center">
          <p className="text-[13px] text-destructive">Error: {error}</p>
        </div>
      ) : showEmpty ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          primaryAction={empty.action}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-[13px]">
              <thead className="[&_tr]:border-b border-border bg-muted/30">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          className={cn(
                            "h-10 px-3 text-left align-middle font-medium text-[11px] uppercase tracking-wider text-muted-foreground",
                            canSort && "cursor-pointer select-none hover:text-foreground",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && (
                              <span className="inline-flex w-3">
                                {sorted === "asc" ? <ChevronUp className="w-3 h-3" /> : sorted === "desc" ? <ChevronDown className="w-3 h-3" /> : null}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={finalColumns.length} className="py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      className={cn(
                        "group border-b border-border/50 transition-colors",
                        onRowClick && "cursor-pointer",
                        "hover:bg-muted/30",
                        row.getIsSelected() && "bg-primary/5",
                      )}
                      style={row.getIsSelected() ? { boxShadow: "inset 3px 0 0 hsl(var(--primary))" } : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 text-[11px] text-muted-foreground tabular-nums">
            <span>
              {rows.length} {rows.length === 1 ? "row" : "rows"}
              {enableSelection && Object.keys(rowSelection).length > 0 && (
                <span className="text-foreground font-medium ml-2">· {Object.keys(rowSelection).length} selected</span>
              )}
            </span>
            {loading && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Refreshing…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Utility for row "actions" column — renders a three-dot button on hover */
export function RowActionsCell({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export { MoreHorizontal };
