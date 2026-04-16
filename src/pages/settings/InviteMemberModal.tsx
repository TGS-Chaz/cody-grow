import { useEffect, useState } from "react";
import { Loader2, Mail, Info } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Role } from "@/hooks/useRoles";
import { cn } from "@/lib/utils";

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  roles: Role[];
}

export default function InviteMemberModal({ open, onClose, roles }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; firstName?: string; lastName?: string; roles?: string }>({});

  useEffect(() => {
    if (!open) return;
    setEmail(""); setFirstName(""); setLastName(""); setMessage(""); setSelectedRoles(new Set()); setErrors({});
  }, [open]);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Valid email required";
    if (!firstName.trim()) next.firstName = "First name required";
    if (!lastName.trim()) next.lastName = "Last name required";
    if (selectedRoles.size === 0) next.roles = "Select at least one role";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast("Invitation queued", {
        description: "Invite delivery requires an Edge Function deployment (planned in a follow-up prompt).",
      });
      onClose();
    }, 600);
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={
        <ModalHeader
          icon={<Mail className="w-4 h-4 text-primary" />}
          title="Invite team member"
          subtitle="They'll get an email to set up their account"
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button type="submit" disabled={sending} className="min-w-[120px]">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send Invite"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Email" required error={errors.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" required error={errors.firstName}>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jordan" />
          </Field>
          <Field label="Last Name" required error={errors.lastName}>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Rivera" />
          </Field>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            Roles<span className="text-destructive ml-0.5">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => {
              const selected = selectedRoles.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors",
                    selected
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
          {errors.roles && <p className="text-[11px] text-destructive">{errors.roles}</p>}
        </div>

        <Field label="Welcome Message (optional)">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Add a personal note to the invite…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
          <span>Invitations will be sent via email once the invite Edge Function is deployed. For now, invites are queued locally.</span>
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
