import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Edit,
  Archive,
  MoreHorizontal,
  Leaf,
  Barcode,
  Users,
  MapPin,
  Building2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import EmptyState from "@/components/shared/EmptyState";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useFacility, useFacilities } from "@/hooks/useFacilities";
import FacilityFormModal from "./FacilityFormModal";
import { toast } from "sonner";

const LICENSE_TYPE_LABELS: Record<string, string> = {
  producer_tier_1: "Producer Tier 1",
  producer_tier_2: "Producer Tier 2",
  producer_tier_3: "Producer Tier 3",
  processor: "Processor",
  producer_processor: "Producer / Processor",
  transporter: "Transporter",
};

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: facility, loading, error } = useFacility(id);
  const { updateFacility, archiveFacility } = useFacilities();
  const [editOpen, setEditOpen] = useState(false);
  const { setContext, clearContext } = useCodyContext();

  useEffect(() => {
    if (!facility) return;
    setContext({
      context_type: "facility_detail",
      context_id: facility.id,
      page_data: {
        facility: {
          name: facility.name,
          license: facility.license_number,
          type: facility.license_type,
          address: `${facility.address_line1}, ${facility.city}, ${facility.state} ${facility.zip}`,
          is_primary: facility.is_primary,
          is_active: facility.is_active,
        },
      },
    });
    return () => clearContext();
  }, [facility, setContext, clearContext]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !facility) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={Building2}
          title={error ? "Couldn't load facility" : "Facility not found"}
          description={error ?? "This facility may have been archived or does not exist."}
          primaryAction={
            <Button onClick={() => navigate("/settings/facilities")}>← Back to facilities</Button>
          }
        />
      </div>
    );
  }

  const handleArchive = async () => {
    if (!confirm(`Archive "${facility.name}"? It can be restored later.`)) return;
    try {
      await archiveFacility(facility.id);
      toast.success("Facility archived");
      navigate("/settings/facilities");
    } catch (e: any) {
      toast.error(e?.message ?? "Archive failed");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={facility.name}
        description={`${LICENSE_TYPE_LABELS[facility.license_type ?? ""] ?? "Facility"} · License ${facility.license_number}`}
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Facilities", to: "/settings/facilities" },
          { label: facility.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings/facilities")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchive} className="text-destructive">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Hero: key info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KeyInfo label="License" value={
          <span className="flex items-center gap-1.5">
            {facility.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
            <CopyableId value={facility.license_number} />
          </span>
        } />
        <KeyInfo label="Type" value={LICENSE_TYPE_LABELS[facility.license_type ?? ""] ?? "—"} />
        <KeyInfo label="UBI" value={facility.ubi_number ? <CopyableId value={facility.ubi_number} /> : "—"} />
        <KeyInfo label="Status" value={
          facility.is_active
            ? <StatusPill label="Active" variant="success" />
            : <StatusPill label="Archived" variant="muted" />
        } />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="canopy">Canopy</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Active Plants" value={0} accentClass="stat-accent-emerald" delay={0} />
            <StatCard label="Active Batches" value={0} accentClass="stat-accent-teal" delay={0.05} />
            <StatCard label="Active Employees" value={0} accentClass="stat-accent-blue" delay={0.1} />
          </div>

          {/* Address card + Cody insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Address
              </h3>
              <div className="text-[13px] text-foreground space-y-0.5">
                <div>{facility.address_line1}</div>
                {facility.address_line2 && <div>{facility.address_line2}</div>}
                <div>{facility.city}, {facility.state} {facility.zip}</div>
              </div>
              {(facility.phone || facility.email) && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-1 text-[12px]">
                  {facility.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{facility.phone}</span></div>}
                  {facility.email && <div><span className="text-muted-foreground">Email:</span> {facility.email}</div>}
                </div>
              )}
            </div>
            <CodyInsightsPanel entity_type="facility" entity_id={facility.id} limit={4} />
          </div>
        </TabsContent>

        <TabsContent value="areas">
          <EmptyState
            icon={Leaf}
            title="No areas yet"
            description="Grow areas associated with this facility will appear here."
            primaryAction={<Button disabled>+ Add Area</Button>}
          />
        </TabsContent>

        <TabsContent value="employees">
          <EmptyState
            icon={Users}
            title="No employees assigned"
            description="Assign employees to this facility to track who works here."
            primaryAction={<Button disabled>+ Assign Employee</Button>}
          />
        </TabsContent>

        <TabsContent value="canopy">
          <EmptyState
            icon={Building2}
            title="No canopy allotments recorded"
            description="WSLCB-approved canopy allotments for this facility will appear here."
            primaryAction={<Button disabled>+ Add Allotment</Button>}
          />
        </TabsContent>

        <TabsContent value="compliance">
          <EmptyState
            icon={Barcode}
            title="No compliance documents"
            description="Upload licenses, insurance, and audit records tied to this facility."
            primaryAction={<Button disabled>Upload Document</Button>}
          />
        </TabsContent>

        <TabsContent value="activity">
          <EmptyState
            icon={Barcode}
            title="No activity yet"
            description="Edits and actions on this facility will be logged here for audit."
          />
        </TabsContent>
      </Tabs>

      <FacilityFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={async (input) => {
          await updateFacility(facility.id, input);
        }}
        editing={facility}
      />
    </div>
  );
}

function KeyInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="text-[14px] font-medium text-foreground">{value}</div>
    </div>
  );
}
