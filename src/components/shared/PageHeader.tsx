import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
}

export default function PageHeader({ title, description, breadcrumbs, actions, tabs }: PageHeaderProps) {
  // Keep the browser tab title in sync with whatever page the user is viewing.
  // Every page in the app renders a PageHeader, so this propagates everywhere.
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · Cody Grow`;
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-[12px] text-muted-foreground mb-3" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 opacity-40" />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold text-foreground tracking-[-0.02em] leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="header-underline mt-4" />
      {tabs && <div className="mt-4">{tabs}</div>}
    </div>
  );
}
