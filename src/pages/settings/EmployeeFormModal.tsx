import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronDown, ChevronUp, Loader2, Camera, Upload, Link2, Unlink, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/shared/UserAvatar";
import { supabase } from "@/lib/supabase";
import { useFacilities } from "@/hooks/useFacilities";
import { Department, Employee, EmployeeInput } from "@/hooks/useEmployees";
import { useOrgMembers, OrgMember } from "@/hooks/useUsers";
import { cn } from "@/lib/utils";

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "cultivation", label: "Cultivation" },
  { value: "processing", label: "Processing" },
  { value: "packaging", label: "Packaging" },
  { value: "quality", label: "Quality" },
  { value: "sales", label: "Sales" },
  { value: "fulfillment", label: "Fulfillment" },
  { value: "delivery", label: "Delivery" },
  { value: "admin", label: "Admin" },
  { value: "management", label: "Management" },
  { value: "other", label: "Other" },
];

const STATUSES: { value: EmployeeInput["employment_status"]; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
  { value: "seasonal", label: "Seasonal" },
  { value: "contractor", label: "Contractor" },
];

interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: Employee | null;
  onSave: (input: EmployeeInput) => Promise<void>;
  /** Pass IDs of employees that already have a linked user_id so the dropdown can filter */
  takenUserIds?: string[];
}

export default function EmployeeFormModal({ open, onClose, editing, onSave, takenUserIds = [] }: EmployeeFormModalProps) {
  const isEditMode = !!editing;
  const { data: facilities } = useFacilities();
  const { data: orgMembers } = useOrgMembers();

  const [form, setForm] = useState<EmployeeInput>({
    first_name: "",
    last_name: "",
    department: "cultivation",
    employment_status: "active",
    hire_date: new Date().toISOString().slice(0, 10),
    job_title: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeInput, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // System access toggle
  const [systemAccess, setSystemAccess] = useState(false);

  // Reset form when opening or editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        first_name: editing.first_name,
        last_name: editing.last_name,
        middle_name: editing.middle_name,
        preferred_name: editing.preferred_name,
        avatar_url: editing.avatar_url,
        email: editing.email,
        phone: editing.phone,
        emergency_contact_name: editing.emergency_contact_name,
        emergency_contact_phone: editing.emergency_contact_phone,
        employee_number: editing.employee_number,
        job_title: editing.job_title ?? "",
        department: editing.department ?? "cultivation",
        hire_date: editing.hire_date,
        termination_date: editing.termination_date,
        employment_status: editing.employment_status,
        wa_drivers_license: editing.wa_drivers_license,
        wa_drivers_license_expires: editing.wa_drivers_license_expires,
        birthdate: editing.birthdate,
        user_id: editing.user_id,
        facility_id: editing.facility_id,
        notes: editing.notes,
      });
      setSystemAccess(!!editing.user_id);
      setShowAdvanced(true);
    } else {
      setForm({
        first_name: "",
        last_name: "",
        department: "cultivation",
        employment_status: "active",
        hire_date: new Date().toISOString().slice(0, 10),
        job_title: "",
      });
      setSystemAccess(false);
      setShowAdvanced(false);
    }
    setErrors({});
  }, [editing, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const set = <K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Available users = org members not yet linked to another employee (or current one)
  const availableUsers: OrgMember[] = useMemo(() => {
    const taken = new Set(takenUserIds);
    if (editing?.user_id) taken.delete(editing.user_id);
    return orgMembers.filter((m) => !taken.has(m.user_id));
  }, [orgMembers, takenUserIds, editing?.user_id]);

  const initials = (form.first_name?.[0] ?? "") + (form.last_name?.[0] ?? "") || "E";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      // Use edit id if present; else temp path that'll be moved server-side (not implemented — just upload with random)
      const prefix = editing?.id ?? "new";
      const path = `employees/${prefix}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      set("avatar_url", `${urlData.publicUrl}?t=${Date.now()}`);
      toast.success("Avatar uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.first_name.trim()) next.first_name = "Required";
    if (!form.last_name.trim()) next.last_name = "Required";
    if (!form.department) next.department = "Required";
    if (!form.job_title?.trim()) next.job_title = "Required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Invalid email";

    // 21+ soft warning (still allow save, but toast)
    if (form.birthdate) {
      const age = Math.floor((Date.now() - new Date(form.birthdate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      if (age < 21) {
        toast.warning("Employee is under 21 — verify WSLCB compliance requirements for your facility.");
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: EmployeeInput = {
        ...form,
        user_id: systemAccess ? form.user_id ?? null : null,
      };
      await onSave(payload);
      toast.success(isEditMode ? "Employee updated" : "Employee added");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[71] w-full max-w-[640px] max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{isEditMode ? "Edit Employee" : "Add Employee"}</h2>
                <p className="text-[11px] text-muted-foreground">Track people who work at your facility</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              {/* Required block */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" required error={errors.first_name}>
                  <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus />
                </Field>
                <Field label="Last Name" required error={errors.last_name}>
                  <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department" required error={errors.department}>
                  <select
                    value={form.department}
                    onChange={(e) => set("department", e.target.value as Department)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
                <Field label="Job Title" required error={errors.job_title}>
                  <Input value={form.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} placeholder="e.g. Lead Grower" />
                </Field>
              </div>
              <Field label="Facility" helper="Recommended. Used to auto-generate employee numbers.">
                <select
                  value={form.facility_id ?? ""}
                  onChange={(e) => set("facility_id", e.target.value || null)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Not assigned —</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Field>

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
                    {/* Identity & Contact */}
                    <Section title="Identity & Contact">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Middle Name">
                          <Input value={form.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value)} />
                        </Field>
                        <Field label="Preferred Name">
                          <Input value={form.preferred_name ?? ""} onChange={(e) => set("preferred_name", e.target.value)} placeholder="What they go by" />
                        </Field>
                      </div>

                      <div className="flex items-center gap-4">
                        <UserAvatar avatarUrl={form.avatar_url} initials={initials} size={56} animated={false} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} className="gap-1.5">
                              {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                              {form.avatar_url ? "Change Photo" : "Upload Photo"}
                            </Button>
                            {form.avatar_url && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => set("avatar_url", null)}>Remove</Button>
                            )}
                          </div>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                          <p className="text-[11px] text-muted-foreground mt-1.5">PNG, JPG. Stored in Supabase Storage.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Email" error={errors.email}>
                          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                        </Field>
                        <Field label="Phone">
                          <Input type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(509) 555-0100" />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Emergency Contact Name">
                          <Input value={form.emergency_contact_name ?? ""} onChange={(e) => set("emergency_contact_name", e.target.value)} />
                        </Field>
                        <Field label="Emergency Contact Phone">
                          <Input type="tel" value={form.emergency_contact_phone ?? ""} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
                        </Field>
                      </div>
                    </Section>

                    {/* Employment */}
                    <Section title="Employment">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Employee Number" helper="Auto-generated from facility license if left blank">
                          <Input value={form.employee_number ?? ""} onChange={(e) => set("employee_number", e.target.value)} placeholder="EMP-123456-0001" className="font-mono" />
                        </Field>
                        <Field label="Status">
                          <select
                            value={form.employment_status}
                            onChange={(e) => set("employment_status", e.target.value as EmploymentStatus)}
                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Hire Date">
                          <Input type="date" value={form.hire_date ?? ""} onChange={(e) => set("hire_date", e.target.value || null)} />
                        </Field>
                        {form.employment_status === "terminated" && (
                          <Field label="Termination Date">
                            <Input type="date" value={form.termination_date ?? ""} onChange={(e) => set("termination_date", e.target.value || null)} />
                          </Field>
                        )}
                      </div>
                    </Section>

                    {/* Compliance */}
                    <Section title="Compliance (WSLCB)">
                      <Field label="Birthdate" helper="Used for age verification (WSLCB requires 21+)">
                        <Input type="date" value={form.birthdate ?? ""} onChange={(e) => set("birthdate", e.target.value || null)} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="WA Driver's License #">
                          <Input value={form.wa_drivers_license ?? ""} onChange={(e) => set("wa_drivers_license", e.target.value)} className="font-mono" />
                        </Field>
                        <Field label="License Expires">
                          <Input type="date" value={form.wa_drivers_license_expires ?? ""} onChange={(e) => set("wa_drivers_license_expires", e.target.value || null)} />
                        </Field>
                      </div>
                    </Section>

                    {/* System Access */}
                    <Section title="System Access">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={systemAccess}
                          onChange={(e) => { setSystemAccess(e.target.checked); if (!e.target.checked) set("user_id", null); }}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span className="text-[13px] text-foreground flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5 text-primary" /> This employee has a Cody Grow login
                        </span>
                      </label>

                      {systemAccess && (
                        <div className="pl-6 space-y-2">
                          {editing?.user_id ? (
                            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                              <div className="text-[12px]">
                                <div className="text-foreground font-medium">
                                  {orgMembers.find((m) => m.user_id === editing.user_id)?.email ?? editing.user_id}
                                </div>
                                <div className="text-muted-foreground text-[11px]">Linked system user</div>
                              </div>
                              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { set("user_id", null); setSystemAccess(false); }}>
                                <Unlink className="w-3 h-3" /> Unlink
                              </Button>
                            </div>
                          ) : (
                            <Field label="Link to existing team member">
                              <select
                                value={form.user_id ?? ""}
                                onChange={(e) => set("user_id", e.target.value || null)}
                                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="">— Select a team member —</option>
                                {availableUsers.map((u) => (
                                  <option key={u.user_id} value={u.user_id}>
                                    {u.email ?? u.user_id} {u.full_name ? `· ${u.full_name}` : ""}
                                  </option>
                                ))}
                              </select>
                              {availableUsers.length === 0 && (
                                <p className="text-[11px] text-muted-foreground mt-1">All team members are already linked. Invite a new one from the Users & Roles page.</p>
                              )}
                            </Field>
                          )}
                          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                            <Info className="w-3 h-3 shrink-0 mt-0.5 text-primary" />
                            <span>Linking gives this employee access to Cody Grow based on their assigned roles on Users &amp; Roles.</span>
                          </div>
                        </div>
                      )}
                    </Section>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 21+ age warning indicator */}
              {form.birthdate && (() => {
                const age = Math.floor((Date.now() - new Date(form.birthdate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                if (age < 21) {
                  return (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-500">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Employee is under 21. WSLCB requires 21+ for licensed cannabis facility access — verify compliance.</span>
                    </div>
                  );
                }
                return null;
              })()}
            </form>

            <div className="flex items-center justify-end gap-2 px-6 h-14 border-t border-border shrink-0">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving} className="min-w-[100px]">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEditMode ? "Save" : "Add Employee"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-t border-border/50 pt-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// Re-import for validate type check
type EmploymentStatus = EmployeeInput["employment_status"];

void Upload; // Unused import guard
