import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useProductAccess } from "@/hooks/useProductAccess";

export default function ProtectedRoute() {
  const { session, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useProductAccess("grow");

  if (authLoading || (session && accessLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/no-access" replace />;
  }

  return <Outlet />;
}
