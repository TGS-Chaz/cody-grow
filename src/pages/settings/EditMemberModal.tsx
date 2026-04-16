import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/shared/UserAvatar";
import { Role } from "@/hooks/useRoles";
import { OrgMember, useOrgUserRoles, useRemoveMember, useUpdateMemberProfile } from "@/hooks/useUsers";
import { cn } from "@/lib/utils";

interface EditMemberModalProps {
  open: boolean;
  onClose: () => void;
  member: OrgMember | null;
  allRoles: Role[];
  assignedRoleIds: string[];
}

export default function EditMemberModal({ open, onClose, member, allRoles, assignedRoleIds }: EditMemberModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removing, setRemoving] = useState(false);

  const updateProfile = useUpdateMemberProfile();
  const { assignRole, unassignRole } = useOrgUserRoles();
  const removeMember = useRemoveMember();

  useEffect(() => {
    if (!open || !member) return;
    setFirstName(member.first_name ?? "");
    setLastName(member.last_name ?? "");
    setSelected(new Set(assignedRoleIds));
    setShowRemove(false);
    setRemoveConfirm("");
  }, [open, member, assignedRoleIds]);

  if (!member) return null;

  const toggleRole = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(member.user_id, {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
      });

      const prev = new Set(assignedRoleIds);
      const toAdd = Array.from(selected).filter((id) => !prev.has(id));
      const toRemove = Array.from(prev).filter((id) => !selected.has(id));
      for (const id of toAdd) await assignRole(member.user_id, id);
      for (const id of toRemove) await unassignRole(member.user_id, id);

      toast.success("Member updated");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (removeConfirm !== (member.email ?? "REMOVE")) return;
    setRemoving(true);
    try {
      await removeMember(member.user_id);
      toast.success("Member removed from organization");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  const initials = (member.first_name?.[0] ?? "") + (member.last_name?.[0] ?? "") || (member.email?.[0]?.toUpperCase() ?? "U");

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      header={<ModalHeader title="Edit member" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-4">
          <UserAvatar avatarUrl={member.avatar_url} initials={initials} size={56} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">{member.email ?? "(no email)"}</p>
            <p className="text-[11px] text-muted-foreground">Member since {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last Name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>

        <Field label="Email">
          <Input value={member.email ?? ""} disabled className="opacity-60 cursor-not-allowed" />
          <p className="text-[11px] text-muted-foreground">Email cannot be changed here. Ask the user to update their own profile.</p>
        </Field>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Roles</label>
          <div className="flex flex-wrap gap-1.5">
            {allRoles.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors",
                    isSel
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <h3 className="text-[12px] font-semibold text-destructive uppercase tracking-wider">Danger zone</h3>
          </div>
          {!showRemove ? (
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">Remove this user from the organization.</p>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setShowRemove(true)}>
                Remove from Org
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-foreground">
                Type <span className="font-mono font-semibold">{member.email ?? "REMOVE"}</span> to confirm removal.
              </p>
              <Input
                value={removeConfirm}
                onChange={(e) => setRemoveConfirm(e.target.value)}
                placeholder={member.email ?? "REMOVE"}
                className="font-mono"
              />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowRemove(false); setRemoveConfirm(""); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={removeConfirm !== (member.email ?? "REMOVE") || removing}
                  onClick={handleRemove}
                >
                  {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Remove"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollableModal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
