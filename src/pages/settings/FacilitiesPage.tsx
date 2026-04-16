import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Warehouse,
  ShieldCheck,
  AlertTriangle,
  Ruler,
  Plus,
  Star,
  MoreHorizontal,
  Edit,
  Eye,
  Archive,
  Download,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import PhaseColorBadge from "@/components/shared/PhaseColorBadge";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useFacilities, useFacilitiesStats, Facility, FacilityInput } from "@/hooks/useFacilities";
import FacilityFormModal from "./FacilityFormModal";

const LICENSE_TYPE_LABELS: Record<string, string> = {
  producer_tier_1: "Tier 1",
  producer_tier_2: "Tier 2",
  producer_tier_3: "Tier 3",
  processor: "Processor",
  producer_processor: "Prod / Proc",
  transporter: "Transporter",
};

export default function FacilitiesPage() {
  const navigate = useNavigate();
  const { data: facilities, loading, error, createFacility, updateFacility, archiveFacility } = useFacilities();
  const stats = useFacilitiesStats(facilities);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Facility | null>(null);
  const { setContext, clearContext } = useCodyContext();

  // Stable payload keyed on primitives so the setContext effect doesn't fire
  // every render (which would cascade through the Cody context provider).
  const facilitiesSignature = useMemo(() => facilities.map((f) => f.id).join(","), [facilities]);
  const codyPayload = useMemo(
    () => ({
      count: stats.total,
      active: stats.active,
      expiringCount: stats.expiringIn30Days,
      totalCanopy: stats.totalCanopy,
      facilities: facilities.map((f) => ({
        name: f.name,
        license: f.license_number,
        type: f.license_type,
        city: f.city,
        is_primary: f.is_primary,
        is_active: f.is_active,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facilitiesSignature, stats.total, stats.active, stats.expiringIn30Days, stats.totalCanopy],
  );

  useEffect(() => {
    setContext({ context_type: "facilities_list", page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload]);

  // Keyboard shortcuts
  useShortcut(["n"], () => { setEditing(null); setModalOpen(true); }, {
    description: "Add new facility",
    scope: "Facilities",
    enabled: !modalOpen,
  });
  useShortcut(["/"], () => {
    const el = document.querySelector<HTMLInputElement>("[data-filters-search]");
    el?.focus();
  }, {
    description: "Focus search",
    scope: "Facilities",
    enabled: !modalOpen,
  });

  const filteredData = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.license_number.toLowerCase().includes(q) ||
      f.city.toLowerCase().includes(q),
    );
  }, [facilities, searchValue]);

  const columns: ColumnDef<Facility>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {row.original.is_primary && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
          <span>{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "license_number",
      header: "License #",
      cell: ({ row }) => <CopyableId value={row.original.license_number} />,
    },
    {
      accessorKey: "license_type",
      header: "Type",
      cell: ({ row }) => (
        row.original.license_type
          ? <span className="text-[12px]">{LICENSE_TYPE_LABELS[row.original.license_type] ?? row.original.license_type}</span>
          : <span className="text-muted-foreground">—</span>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-[12px] text-muted-foreground">
          {row.original.city}, {row.original.state}
        </span>
      ),
    },
    {
      accessorKey: "ubi_number",
      header: "UBI",
      cell: ({ row }) => (
        row.original.ubi_number
          ? <CopyableId value={row.original.ubi_number} />
          : <span className="text-muted-foreground">—</span>
      ),
    },
    {
      id: "canopy",
      header: "Canopy (sqft)",
      cell: () => <span className="font-mono text-[12px] text-muted-foreground tabular-nums">—</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        row.original.is_active
          ? <StatusPill label="Active" variant="success" />
          : <PhaseColorBadge phase="transferred" label="Archived" />
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/settings/facilities/${row.original.id}`)}>
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditing(row.original); setModalOpen(true); }}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  if (confirm(`Archive "${row.original.name}"?`)) {
                    await archiveFacility(row.original.id);
                  }
                }}
                className="text-destructive"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
  ], [navigate, archiveFacility]);

  const handleSave = async (input: FacilityInput) => {
    if (editing) {
      await updateFacility(editing.id, input);
    } else {
      await createFacility(input);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Facilities"
        description="Licensed locations where your cannabis operation runs"
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Facilities" },
        ]}
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Facility
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Facilities" value={stats.total} accentClass="stat-accent-blue" delay={0} />
        <StatCard label="Active" value={stats.active} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard
          label="Expiring in 30 Days"
          value={stats.expiringIn30Days}
          accentClass={stats.expiringIn30Days > 0 ? "stat-accent-amber" : "stat-accent-emerald"}
          delay={0.1}
        />
        <StatCard label="Total Canopy (sqft)" value={stats.totalCanopy} accentClass="stat-accent-teal" delay={0.15} />
      </div>

      {/* Filters + Table */}
      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search name, license #, or city…"
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" disabled>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filteredData}
        loading={loading}
        error={error}
        onRowClick={(f) => navigate(`/settings/facilities/${f.id}`)}
        empty={{
          icon: Warehouse,
          title: "Add your first facility",
          description: "Cody Grow works with your WSLCB licensed locations. Add your primary facility to get started.",
          action: (
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add First Facility
              </Button>
              <Button variant="outline" disabled className="gap-1.5">
                Import from CCRS
              </Button>
            </div>
          ),
        }}
      />

      <FacilityFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        editing={editing}
      />
    </div>
  );
}

// Simple placeholder icons to avoid unused imports
void Warehouse; void ShieldCheck; void AlertTriangle; void Ruler;
