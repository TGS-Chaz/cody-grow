import { useEffect, useState } from "react";
import { Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductLine, ProductLineInput } from "@/hooks/useProductLines";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: ProductLineInput) => Promise<void>;
  editing?: ProductLine | null;
}

export default function ProductLineFormModal({ open, onClose, onSave, editing }: Props) {
  const isEdit = !!editing;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setSortOrder(String(editing.sort_order ?? 0));
      setIsActive(editing.is_active);
    } else {
      setName(""); setDescription(""); setSortOrder("0"); setIsActive(true);
    }
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
      });
      toast.success(isEdit ? "Product line updated" : "Product line created");
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
      size="sm"
      onSubmit={handleSubmit}
      header={
        <ModalHeader
          icon={<FolderOpen className="w-4 h-4 text-primary" />}
          title={isEdit ? "Edit product line" : "New product line"}
          subtitle="Grouping for related products"
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[100px]">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Name" required error={error ?? undefined}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="e.g. Premium Flower" autoFocus />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What kind of products belong in this line?"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Sort Order">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="font-mono w-28" />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer select-none h-10">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-[13px] text-foreground">Active</span>
          </label>
        </div>
      </div>
    </ScrollableModal>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
