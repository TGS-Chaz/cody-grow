import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Star, Building2 } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facility, FacilityInput } from "@/hooks/useFacilities";

interface FacilityFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: FacilityInput) => Promise<void>;
  editing?: Facility | null;
}

const LICENSE_TYPES = [
  { value: "producer_tier_1", label: "Producer Tier 1" },
  { value: "producer_tier_2", label: "Producer Tier 2" },
  { value: "producer_tier_3", label: "Producer Tier 3" },
  { value: "processor", label: "Processor" },
  { value: "producer_processor", label: "Producer / Processor" },
  { value: "transporter", label: "Transporter" },
];

export default function FacilityFormModal({ open, onClose, onSave, editing }: FacilityFormModalProps) {
  const isEditMode = !!editing;
  const [form, setForm] = useState<FacilityInput>({
    name: "",
    license_number: "",
    license_type: "producer_tier_2",
    address_line1: "",
    city: "",
    state: "WA",
    zip: "",
    is_primary: false,
    is_active: true,
    ccrs_location_code: "0001",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FacilityInput, string>>>({});

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        license_number: editing.license_number,
        license_type: editing.license_type ?? "producer_tier_2",
        ubi_number: editing.ubi_number,
        dea_registration: editing.dea_registration,
        address_line1: editing.address_line1,
        address_line2: editing.address_line2,
        city: editing.city,
        state: editing.state,
        zip: editing.zip,
        phone: editing.phone,
        email: editing.email,
        ccrs_location_code: editing.ccrs_location_code,
        is_primary: editing.is_primary,
        is_active: editing.is_active,
      });
      setShowAdvanced(true);
    } else {
      // Reset to defaults
      setForm({
        name: "",
        license_number: "",
        license_type: "producer_tier_2",
        address_line1: "",
        city: "",
        state: "WA",
        zip: "",
        is_primary: false,
        is_active: true,
        ccrs_location_code: "0001",
      });
      setShowAdvanced(false);
    }
    setErrors({});
  }, [editing, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const set = <K extends keyof FacilityInput>(field: K, value: FacilityInput[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^\d{6,}$/.test(form.license_number.trim())) next.license_number = "License number should be 6+ digits";
    if (!form.license_type) next.license_type = "License type is required";
    if (!/^\d{5}$/.test(form.zip.trim())) next.zip = "ZIP must be 5 digits";
    if (showAdvanced) {
      if (!form.address_line1?.trim()) next.address_line1 = "Address is required";
      if (!form.city?.trim()) next.city = "City is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Minimal-mode defaults: if user didn't fill address, put placeholders
    const payload: FacilityInput = {
      ...form,
      address_line1: form.address_line1?.trim() || "—",
      city: form.city?.trim() || "Unknown",
    };

    setSaving(true);
    try {
      await onSave(payload);
      toast.success(isEditMode ? "Facility updated" : "Facility created");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={
        <ModalHeader
          icon={<Building2 className="w-4 h-4 text-primary" />}
          title={isEditMode ? "Edit Facility" : "Add Facility"}
          subtitle="Licensed location where your operation runs"
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[100px]">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEditMode ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
              {/* Required fields */}
              <div className="space-y-4">
                <Field label="Name" required error={errors.name}>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Yakima Greenhouse" autoFocus />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="License Number" required error={errors.license_number}>
                    <Input value={form.license_number} onChange={(e) => set("license_number", e.target.value.replace(/\D/g, ""))} placeholder="123456" className="font-mono" maxLength={10} />
                  </Field>
                  <Field label="License Type" required error={errors.license_type}>
                    <select
                      value={form.license_type ?? ""}
                      onChange={(e) => set("license_type", e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {LICENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="ZIP Code" required error={errors.zip} helper="We'll fill city & state from ZIP in the advanced section">
                  <Input value={form.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} placeholder="98908" className="font-mono w-32" maxLength={5} />
                </Field>
              </div>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 pt-2"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAdvanced ? "Hide all fields" : "Show all fields"}
              </button>

              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5 overflow-hidden"
                  >
                    {/* License details */}
                    <Section title="License Details">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="UBI Number">
                          <Input value={form.ubi_number ?? ""} onChange={(e) => set("ubi_number", e.target.value)} placeholder="9-digit UBI" className="font-mono" />
                        </Field>
                        <Field label="DEA Registration">
                          <Input value={form.dea_registration ?? ""} onChange={(e) => set("dea_registration", e.target.value)} placeholder="Optional" className="font-mono" />
                        </Field>
                      </div>
                      <Field label="CCRS Location Code" helper="Used in CCRS CSV uploads. Default 0001">
                        <Input value={form.ccrs_location_code ?? ""} onChange={(e) => set("ccrs_location_code", e.target.value)} placeholder="0001" className="font-mono w-32" maxLength={4} />
                      </Field>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!form.is_primary}
                          onChange={(e) => set("is_primary", e.target.checked)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span className="text-[13px] text-foreground flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500" /> Mark as primary facility
                        </span>
                      </label>
                    </Section>

                    {/* Address */}
                    <Section title="Address">
                      <Field label="Address Line 1" error={errors.address_line1}>
                        <Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} placeholder="123 Main St" />
                      </Field>
                      <Field label="Address Line 2">
                        <Input value={form.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} placeholder="Suite 100" />
                      </Field>
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                        <Field label="City" error={errors.city}>
                          <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Yakima" />
                        </Field>
                        <Field label="State">
                          <Input value={form.state ?? "WA"} disabled className="w-16 font-mono opacity-60" />
                        </Field>
                        <Field label="ZIP">
                          <Input value={form.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} className="w-24 font-mono" maxLength={5} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Phone">
                          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(509) 555-0100" />
                        </Field>
                        <Field label="Email">
                          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="contact@facility.com" />
                        </Field>
                      </div>
                    </Section>

                    {/* Status */}
                    <Section title="Status">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.is_active ?? true}
                          onChange={(e) => set("is_active", e.target.checked)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span className="text-[13px] text-foreground">Active</span>
                      </label>
                    </Section>
                  </motion.div>
                )}
              </AnimatePresence>
      </div>
    </ScrollableModal>
  );
}

function Field({ label, required, error, helper, children }: { label: string; required?: boolean; error?: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {!error && helper && <p className="text-[11px] text-muted-foreground/70">{helper}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
