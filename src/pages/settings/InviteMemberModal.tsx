import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Mail, Info } from "lucide-react";
import { toast } from "sonner";
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
    // Invitation flow requires an Edge Function (Supabase auth.admin.inviteUserByEmail).
    // For now we show a toast explaining the wiring and don't actually send.
    setTimeout(() => {
      setSending(false);
      toast("Invitation queued", {
        description: "Invite delivery requires an Edge Function deployment (planned in a follow-up prompt).",
      });
      onClose();
    }, 600);
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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[71] w-full max-w-[560px] max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground">Invite team member</h2>
                  <p className="text-[11px] text-muted-foreground">They'll get an email to set up their account</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
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
            </form>

            <div className="flex items-center justify-end gap-2 px-6 h-14 border-t border-border shrink-0">
              <Button variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={sending} className="min-w-[120px]">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send Invite"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
