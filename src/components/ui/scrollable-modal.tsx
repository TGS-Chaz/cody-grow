import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ScrollableModal — design-system-compliant modal with sticky header,
 * scrollable body, and sticky footer.
 *
 * Centering strategy: the backdrop is a flex container (items-center justify-center)
 * and the modal is a flex child. This avoids the classic transform-conflict bug
 * where Tailwind's `-translate-x-1/2 -translate-y-1/2` collides with Framer Motion's
 * animated `y`/`scale` transforms — FM overwrites the translate and the modal's
 * bottom edge drops off-screen.
 *
 * Body layout: `max-h-[90vh]` container + `flex flex-col` + a `flex-1 min-h-0 overflow-y-auto`
 * body. The `min-h-0` is critical — flex children default to `min-height: auto` which
 * prevents shrinking below content size. Without it, the modal grows past max-h and
 * the sticky footer gets pushed off-screen.
 */
interface ScrollableModalProps {
  open: boolean;
  onClose: () => void;
  /** Max width class. Use "sm" (480px), "md" (640px), "lg" (760px), "xl" (900px). */
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When the body is rendered inside a <form>, pass onSubmit so footer buttons can be type="submit". */
  onSubmit?: (e: React.FormEvent) => void;
  /**
   * By default, children are wrapped in a `<div className="flex-1 min-h-0 overflow-y-auto">`.
   * Set to true if the caller needs to supply its own flex layout inside the body
   * (e.g. a two-column layout with independent scroll regions). Caller is responsible
   * for including `flex-1 min-h-0` on its root container.
   */
  customBody?: boolean;
  /** Raise the z-index if nesting modals (default 70). */
  zIndex?: number;
}

const SIZE_CLASS: Record<NonNullable<ScrollableModalProps["size"]>, string> = {
  sm: "max-w-[480px]",
  md: "max-w-[640px]",
  lg: "max-w-[760px]",
  xl: "max-w-[900px]",
};

export default function ScrollableModal({
  open,
  onClose,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  header,
  footer,
  children,
  className,
  onSubmit,
  customBody,
  zIndex = 70,
}: ScrollableModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll while modal is open so background doesn't scroll behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const bodyInner = customBody ? (
    children
  ) : (
    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
  );

  const footerNode = footer && (
    <div className="flex items-center justify-end gap-2 px-6 h-14 border-t border-border shrink-0 bg-card">
      {footer}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
          style={{ zIndex }}
          onClick={closeOnBackdrop ? onClose : undefined}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              // Layout: full width up to size cap, height up to 90% of viewport, flex column
              "w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl",
              SIZE_CLASS[size],
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
              <div className="min-w-0 flex-1">{header}</div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground shrink-0 ml-2"
                aria-label="Close"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {onSubmit ? (
              <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {bodyInner}
                {footerNode}
              </form>
            ) : (
              <>
                {bodyInner}
                {footerNode}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Convenience wrapper for the standard modal header — title + subtitle with optional icon. */
export function ModalHeader({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-foreground truncate">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

/** Convenience wrapper for the standard modal body — padded container. */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-6 space-y-4", className)}>{children}</div>;
}
