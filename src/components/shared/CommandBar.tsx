import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Leaf,
  CalendarDays,
  Scissors,
  Package,
  Barcode,
  FlaskConical,
  Building2,
  ShoppingCart,
  Truck,
  ShieldCheck,
  Settings,
  User,
  Sparkles,
  Warehouse,
  Plus,
  Loader2,
  ArrowRight,
  Dna,
  FileText,
  Users as UsersIcon,
} from "lucide-react";
import codyIcon from "@/assets/cody-icon.svg";
import { useGlobalSearch, ENTITY_LABELS, ENTITY_LIST_PATH, SearchEntity } from "@/hooks/useGlobalSearch";

interface CommandItem {
  id: string;
  label: string;
  to?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  shortcut?: string[];
  keywords?: string[];
}

const ENTITY_ICON: Record<SearchEntity, any> = {
  plant: Leaf,
  batch: Barcode,
  strain: Dna,
  account: Building2,
  order: ShoppingCart,
  product: Package,
  cycle: CalendarDays,
  harvest: Scissors,
  employee: UsersIcon,
  manifest: FileText,
};

export default function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { results, byEntity, counts, isSearching } = useGlobalSearch(query);
  const hasResults = results.length > 0;
  const hasQuery = query.trim().length >= 2;

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleRun = (item: CommandItem) => {
    setOpen(false);
    setQuery("");
    if (item.action) item.action();
    if (item.to) navigate(item.to);
  };

  const askCody = () => {
    setOpen(false);
    const msg = query.trim();
    setQuery("");
    window.dispatchEvent(new Event("open-cody-chat"));
    if (msg) {
      // Dispatch a follow-up event with the query so AskCody can pre-fill
      window.dispatchEvent(new CustomEvent("cody-prefill", { detail: msg }));
    }
  };

  const navItems: CommandItem[] = [
    { id: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, group: "Navigate" },
    { id: "plants", label: "Plants", to: "/cultivation/plants", icon: Leaf, group: "Navigate" },
    { id: "cycles", label: "Grow Cycles", to: "/cultivation/grow-cycles", icon: CalendarDays, group: "Navigate" },
    { id: "harvests", label: "Harvests", to: "/cultivation/harvests", icon: Scissors, group: "Navigate" },
    { id: "products", label: "Products", to: "/inventory/products", icon: Package, group: "Navigate" },
    { id: "batches", label: "Batches", to: "/inventory/batches", icon: Barcode, group: "Navigate" },
    { id: "lab", label: "Lab Testing", to: "/inventory/lab-testing", icon: FlaskConical, group: "Navigate" },
    { id: "accounts", label: "Accounts", to: "/sales/accounts", icon: Building2, group: "Navigate" },
    { id: "orders", label: "Orders", to: "/sales/orders", icon: ShoppingCart, group: "Navigate" },
    { id: "fulfillment", label: "Fulfillment", to: "/sales/fulfillment", icon: Truck, group: "Navigate" },
    { id: "ccrs", label: "CCRS Dashboard", to: "/compliance/ccrs", icon: ShieldCheck, group: "Navigate" },
    { id: "settings", label: "Settings", to: "/settings", icon: Settings, group: "Navigate" },
    { id: "facilities", label: "Facilities", to: "/settings/facilities", icon: Warehouse, group: "Navigate" },
    { id: "profile", label: "My Profile", to: "/profile", icon: User, group: "Navigate" },
  ];

  const quickActions: CommandItem[] = [
    { id: "new-facility", label: "New Facility", to: "/settings/facilities?new=1", icon: Plus, group: "Create", keywords: ["add", "create"] },
    { id: "new-plant", label: "New Plant", to: "/cultivation/plants?new=1", icon: Plus, group: "Create", keywords: ["add", "create"] },
    { id: "new-cycle", label: "New Grow Cycle", to: "/cultivation/grow-cycles?new=1", icon: Plus, group: "Create" },
    { id: "new-account", label: "New Account", to: "/sales/accounts?new=1", icon: Plus, group: "Create" },
    { id: "new-order", label: "New Order", to: "/sales/orders?new=1", icon: Plus, group: "Create" },
  ];

  return (
    <AnimatePresence>
      {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              label="Command menu"
              className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
                <img src={codyIcon} alt="" className="w-4 h-4" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search plants, batches, orders, accounts… or ask Cody"
                  className="flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground/60 focus:outline-none"
                />
                {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">esc</kbd>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-[12px] text-muted-foreground">
                  {hasQuery && !isSearching ? "No matches. Press Enter to ask Cody." : "Start typing to search…"}
                </Command.Empty>

                {hasResults && (Object.keys(byEntity) as SearchEntity[]).map((entity) => {
                  const items = byEntity[entity];
                  if (items.length === 0) return null;
                  const Icon = ENTITY_ICON[entity];
                  return (
                    <Command.Group key={entity} heading={ENTITY_LABELS[entity]} className="[&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wider [&>[cmdk-group-heading]]:text-muted-foreground [&>[cmdk-group-heading]]:px-2 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:mt-2">
                      {items.map((item) => (
                        <Command.Item
                          key={`${entity}:${item.id}`}
                          value={`${entity} ${item.label} ${item.sublabel ?? ""}`}
                          onSelect={() => { setOpen(false); setQuery(""); navigate(item.href); }}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                        >
                          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 min-w-0 truncate">{item.label}</span>
                          {item.sublabel && <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{item.sublabel}</span>}
                        </Command.Item>
                      ))}
                      {counts[entity] >= 5 && (
                        <Command.Item
                          value={`view-all-${entity}`}
                          onSelect={() => { setOpen(false); setQuery(""); navigate(ENTITY_LIST_PATH[entity]); }}
                          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] cursor-pointer text-muted-foreground hover:text-primary data-[selected=true]:bg-accent"
                        >
                          <ArrowRight className="w-3 h-3" />
                          View all {ENTITY_LABELS[entity]} →
                        </Command.Item>
                      )}
                    </Command.Group>
                  );
                })}

                {!hasResults && !hasQuery && (
                  <>
                    <Command.Group heading="Create" className="[&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wider [&>[cmdk-group-heading]]:text-muted-foreground [&>[cmdk-group-heading]]:px-2 [&>[cmdk-group-heading]]:py-1.5">
                      {quickActions.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                          onSelect={() => handleRun(item)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                        >
                          <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          {item.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                    <Command.Group heading="Navigate" className="[&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wider [&>[cmdk-group-heading]]:text-muted-foreground [&>[cmdk-group-heading]]:px-2 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:mt-2">
                      {navItems.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={item.label}
                          onSelect={() => handleRun(item)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                        >
                          <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          {item.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </>
                )}

                <Command.Group heading="AI" className="[&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wider [&>[cmdk-group-heading]]:text-muted-foreground [&>[cmdk-group-heading]]:px-2 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:mt-2">
                  <Command.Item
                    value="ask cody"
                    onSelect={askCody}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    {query ? <>Ask Cody: <span className="text-foreground font-medium ml-1">{query}</span></> : "Ask Cody anything…"}
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
