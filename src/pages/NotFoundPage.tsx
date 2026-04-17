import { useNavigate } from "react-router-dom";
import { Compass, ArrowLeft, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Page not found" description="The URL you followed doesn't match any route in Cody Grow" />

      <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-[22px] font-bold">Lost in the grow?</h2>
          <p className="text-[13px] text-muted-foreground mt-2">
            This page doesn't exist. It may have been moved, archived, or the link might be outdated.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            {typeof window !== "undefined" ? window.location.pathname : ""}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Go back
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
