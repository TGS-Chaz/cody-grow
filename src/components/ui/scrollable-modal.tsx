import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ScrollableModal — design-system-compliant modal with sticky header,
 * scrollable body, and sticky footer.
 *
 * Critical detail: the body uses `min-h-0` so flex-1 can shrink below its
 * content size, enabling overflow:auto to scroll. Without min-h-0, a flex
 * column child defaults to `min-height: auto` and the modal will grow past
 * max-height, cutting off the sticky footer.
 */
interface ScrollableModalProps {
  open: boolean;
  onClose: () => void;
  /** Max width class. Use "max-w-[480px]" (default), "max-w-[640px]" (forms), "max-w-[900px]" (wide content). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional close-on-backdrop-click. Default true. */
  closeOnBackdrop?: boolean;
  /** Optional close-on-Escape. Default true. */
  closeOnEscape?: boolean;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When the body is rendered inside a <form>, pass the onSubmit here so buttons in the footer can be type="submit". */
  onSubmit?: (e: React.FormEvent) => void;
  /** Raise the z-index if nesting modals (default 70 backdrop / 71 content). */
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
  zIndex = 70,
}: ScrollableModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeOnEscape, onClose]);

  const bodyInner = (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {children}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            style={{ zIndex }}
            onClick={closeOnBackdrop ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl",
              SIZE_CLASS[size],
              className,
            )}
            style={{ zIndex: zIndex + 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
              <div className="min-w-0">{header}</div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground shrink-0 ml-2"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body — wrapped in a <form> if onSubmit provided */}
            {onSubmit ? (
              <form
                onSubmit={onSubmit}
                className="flex flex-col flex-1 min-h-0 overflow-hidden"
              >
                {bodyInner}
                {footer && (
                  <div className="flex items-center justify-end gap-2 px-6 h-14 border-t border-border shrink-0 bg-card">
                    {footer}
                  </div>
                )}
              </form>
            ) : (
              <>
                {bodyInner}
                {footer && (
                  <div className="flex items-center justify-end gap-2 px-6 h-14 border-t border-border shrink-0 bg-card">
                    {footer}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </>
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
