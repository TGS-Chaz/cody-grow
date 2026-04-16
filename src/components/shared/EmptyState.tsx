import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** @deprecated Use primaryAction instead */
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, primaryAction, secondaryAction, action }: EmptyStateProps) {
  const primary = primaryAction ?? action;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl scale-150" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary border border-border">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      {(primary || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2">
          {primary}
          {secondaryAction}
        </div>
      )}
    </motion.div>
  );
}
