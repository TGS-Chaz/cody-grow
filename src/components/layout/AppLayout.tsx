import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  LayoutDashboard,
  Leaf,
  CalendarDays,
  Scissors,
  Package,
  Barcode,
  FlaskConical,
  Factory,
  Tag,
  Trash2,
  Building2,
  ShoppingCart,
  Truck,
  ShieldCheck,
  FileText,
  ClipboardList,
  BookOpen,
  ScrollText,
  BarChart3,
  Store,
  AlertOctagon,
  Boxes,
  Thermometer,
  Settings,
  LogOut,
  Sun,
  Moon,
  Sunset,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Dna,
  MapPin,
  Sprout,
  LayoutGrid,
} from "lucide-react";
import { NavLink } from "@/components/shared/NavLink";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useProfile, profileInitials } from "@/lib/profile";
import UserAvatar from "@/components/shared/UserAvatar";
import codyIcon from "@/assets/cody-icon.svg";
import { Toaster } from "@/components/ui/sonner";
import AskCody from "@/components/cody/AskCody";
import CodyContextProvider from "@/components/cody/CodyContextProvider";
import CommandBar from "@/components/shared/CommandBar";
import NotificationBell from "@/components/shared/NotificationBell";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { useUserPermissions } from "@/hooks/usePermissionCheck";

interface NavItem { to: string; icon: any; label: string; required?: string[] }
interface NavGroup { label: string; items: NavItem[]; required?: string[] }

const navGroups: NavGroup[] = [
  { label: "Overview", items: [
    // Dashboard is always visible
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ]},
  { label: "Cultivation", required: ["view_plants", "view_grow_board", "view_strains", "view_cycles", "view_harvests"], items: [
    { to: "/cultivation/board", icon: LayoutGrid, label: "Grow Board", required: ["view_grow_board"] },
    { to: "/cultivation/strains", icon: Dna, label: "Strains", required: ["view_strains"] },
    { to: "/cultivation/areas", icon: MapPin, label: "Areas", required: ["view_areas"] },
    { to: "/cultivation/products", icon: Package, label: "Products", required: ["view_products"] },
    { to: "/cultivation/sources", icon: Sprout, label: "Grow Sources", required: ["view_sources"] },
    { to: "/cultivation/plants", icon: Leaf, label: "Plants", required: ["view_plants"] },
    { to: "/cultivation/grow-cycles", icon: CalendarDays, label: "Grow Cycles", required: ["view_cycles"] },
    { to: "/cultivation/harvests", icon: Scissors, label: "Harvests", required: ["view_harvests"] },
  ]},
  { label: "Operations", required: ["view_tasks", "view_grow_logs", "view_environment"], items: [
    { to: "/operations/tasks", icon: ClipboardList, label: "Tasks", required: ["view_tasks"] },
    { to: "/operations/logs", icon: BookOpen, label: "Grow Logs", required: ["view_grow_logs"] },
    { to: "/operations/environment", icon: Thermometer, label: "Environment", required: ["view_environment"] },
  ]},
  { label: "Inventory", required: ["view_batches", "view_qa", "view_production"], items: [
    { to: "/inventory/batches", icon: Barcode, label: "Batches", required: ["view_batches"] },
    { to: "/inventory/qa", icon: FlaskConical, label: "QA & Lab Testing", required: ["view_qa"] },
    { to: "/inventory/production", icon: Factory, label: "Production", required: ["view_production"] },
    { to: "/inventory/supplies", icon: Boxes, label: "Supplies", required: ["view_batches"] },
  ]},
  { label: "Sales & Fulfillment", required: ["view_accounts", "create_order", "view_orders", "view_manifests"], items: [
    { to: "/sales/accounts", icon: Building2, label: "Accounts", required: ["view_accounts"] },
    { to: "/sales/orders", icon: ShoppingCart, label: "Orders", required: ["view_orders", "create_order"] },
    { to: "/sales/manifests", icon: FileText, label: "Manifests", required: ["view_manifests"] },
    { to: "/sales/transfers", icon: Truck, label: "Inbound Transfers", required: ["view_manifests"] },
    { to: "/marketplace", icon: Store, label: "Marketplace", required: ["view_accounts"] },
  ]},
  { label: "Reports", items: [
    { to: "/reports", icon: BarChart3, label: "Reports" },
  ]},
  { label: "Compliance", required: ["view_audit_log", "upload_to_ccrs", "view_recalls", "view_disposals", "view_labels"], items: [
    { to: "/compliance/ccrs", icon: ShieldCheck, label: "CCRS Dashboard", required: ["upload_to_ccrs", "view_audit_log"] },
    { to: "/compliance/audit", icon: ScrollText, label: "Audit Log", required: ["view_audit_log"] },
    { to: "/compliance/recalls", icon: AlertOctagon, label: "Recalls", required: ["view_recalls"] },
    { to: "/compliance/disposals", icon: Trash2, label: "Disposals", required: ["view_disposals"] },
    { to: "/compliance/labels", icon: Tag, label: "Labels", required: ["view_labels"] },
  ]},
  { label: "Settings", required: ["manage_settings", "manage_users", "manage_employees", "manage_facilities", "manage_equipment", "manage_fleet", "manage_integrations"], items: [
    { to: "/settings", icon: Settings, label: "Configuration" },
  ]},
];

const navItems = navGroups.flatMap((g) => g.items);

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const { preference, toggle: toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const { keys: permKeys, isOwner, loading: permsLoading } = useUserPermissions();

  // Filter navGroups based on permissions. Owners + loading state see everything.
  // A group is shown if ANY of its required keys is granted, or if it has no required.
  const visibleGroups = (permsLoading || isOwner) ? navGroups : navGroups.map((g) => {
    const items = g.items.filter((it) => !it.required || it.required.some((k) => permKeys.has(k)));
    if (items.length === 0) return null;
    if (g.required && !g.required.some((k) => permKeys.has(k)) && items.length === 0) return null;
    return { ...g, items };
  }).filter(Boolean) as NavGroup[];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <CodyContextProvider>
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
        style={{
          background: 'hsl(var(--sidebar-background))',
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        {/* Logo */}
        <div
          className={`flex items-center ${collapsed ? "justify-center px-2" : "gap-1 px-5"} h-14`}
          style={{ borderBottom: '1px solid var(--glass-border-subtle)' }}
        >
          <img src={codyIcon} alt="" className="h-6 w-auto shrink-0" />
          {!collapsed && (
            <div className="flex items-baseline" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>
              <span style={{ color: "hsl(var(--primary))" }}>c</span>
              <span className="text-foreground">ody</span>
              <span
                className="ml-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm self-center"
                style={{ background: "hsl(168 100% 42% / 0.12)", color: "hsl(168 100% 42%)" }}
              >
                grow
              </span>
            </div>
          )}
        </div>

        {/* Nav — grouped, scrolls when content exceeds viewport (full sidebar is long) */}
        <nav className="flex-1 min-h-0 px-2 pt-2 pb-2 overflow-y-auto space-y-1">
          <LayoutGroup>
            {visibleGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                )}
                {collapsed && <div className="pt-2" />}
                {group.items.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== "/dashboard" && item.to !== "/settings" && location.pathname.startsWith(item.to));
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/dashboard" || item.to === "/settings"}
                      className={`relative flex items-center ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"} py-1.5 rounded-md text-[12px] transition-all duration-150 ${
                        isActive
                          ? "font-medium bg-accent text-foreground"
                          : "text-sidebar-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                      activeClassName=""
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <item.icon
                        className={`w-3.5 h-3.5 shrink-0 transition-colors duration-150 ${
                          isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </LayoutGroup>
        </nav>

        {/* Ask Cody button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => window.dispatchEvent(new Event("open-cody-chat"))}
            className={`flex items-center ${collapsed ? "justify-center px-2" : "gap-2 px-3"} w-full py-2 rounded-lg text-[12px] font-medium transition-all duration-150 hover:bg-primary/10 text-muted-foreground hover:text-primary`}
            style={{ background: "hsl(168 100% 42% / 0.05)", border: "1px solid hsl(168 100% 42% / 0.12)" }}
            title="Ask Cody"
          >
            <img src={codyIcon} alt="" className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <>
                <span>Ask Cody</span>
                <Sparkles className="w-3 h-3 ml-auto text-primary/50" />
              </>
            )}
          </button>
        </div>

        {/* Bottom — user + sign out */}
        <div
          className="p-3"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          {user && !collapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <button
                onClick={() => navigate("/profile")}
                className="shrink-0 hover:opacity-80 transition-opacity"
                title="Edit profile"
              >
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  initials={profileInitials(profile, user.email)}
                  size={24}
                />
              </button>
              <span className="text-[11px] text-foreground/70 truncate flex-1">
                {profile?.full_name ?? user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {user && collapsed && (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => navigate("/profile")}
                className="hover:opacity-80 transition-opacity"
                title="Edit profile"
              >
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  initials={profileInitials(profile, user.email)}
                  size={24}
                />
              </button>
              <button
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive transition-colors py-1"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2 px-2"} mt-1`}>
            {!collapsed && <div className="flex-1" />}
            <button
              onClick={toggleTheme}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={preference === "light" ? "Light mode" : preference === "dark" ? "Dark mode" : "Auto (time-based)"}
            >
              {preference === "light" ? <Sun className="w-3.5 h-3.5" /> : preference === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sunset className="w-3.5 h-3.5 text-primary" />}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center px-4 h-12"
          style={{
            background: 'hsl(var(--sidebar-background))',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <img src={codyIcon} alt="" className="h-5 w-auto shrink-0" />
          <div className="flex items-baseline ml-1" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>
            <span style={{ color: "hsl(var(--primary))" }}>c</span>
            <span className="text-foreground">ody</span>
          </div>
          <div className="ml-auto"><NotificationBell /></div>
        </header>

        {/* Desktop top bar */}
        <div
          className="hidden md:flex items-center justify-end px-4 h-10"
          style={{ borderBottom: '1px solid var(--glass-border-subtle)' }}
        >
          <NotificationBell />
        </div>

        <div className="flex-1 overflow-auto pb-20 md:pb-6 dot-grid">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <ErrorBoundary key={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around h-14 z-50"
          style={{
            background: 'hsl(var(--sidebar-background))',
            borderTop: '1px solid var(--glass-border)',
          }}
        >
          {visibleGroups.flatMap((g) => g.items).slice(0, 5).map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors duration-150 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                activeClassName=""
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </main>
      <Toaster />
      <AskCody />
      <CommandBar />
    </div>
    </CodyContextProvider>
  );
}
