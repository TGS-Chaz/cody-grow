import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock, Leaf, Scale, ClipboardList, BookOpen, Trash2, Barcode, LogOut, X, Delete,
  ArrowLeft, CheckCircle2, Loader2, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BarcodeRenderer from "@/components/shared/BarcodeRenderer";
import { useOrg } from "@/lib/org";
import {
  useKioskSession, useKioskLogin, useLatestPunch, useKioskPunch, useKioskTasks,
  useKioskScanPlant, useKioskScanBatch, useKioskLog,
  useKioskScaleReading, useKioskActiveHarvests, useKioskRecordInventoryWaste,
} from "@/hooks/useKiosk";
import { supabase } from "@/lib/supabase";
import { useCompleteTask } from "@/hooks/useTasks";
import { useRecordWetWeight, useRecordDryWeight } from "@/hooks/useHarvests";
import { useDestroyPlant } from "@/hooks/usePlants";
import { CCRS_ADJUSTMENT_REASONS, CCRS_DESTRUCTION_REASONS, CCRS_DESTRUCTION_METHODS, CcrsDestructionReason, CcrsDestructionMethod } from "@/lib/schema-enums";
import { cn } from "@/lib/utils";

type Screen = "login" | "home" | "clock" | "scan-plant" | "weigh" | "tasks" | "log" | "waste" | "scan-batch";

export default function KioskPage() {
  const { session, setSession, signOut } = useKioskSession();
  const [screen, setScreen] = useState<Screen>(session ? "home" : "login");

  useEffect(() => {
    // Lock viewport, force dark theme for kiosk
    document.documentElement.classList.add("dark");
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = "";
    };
  }, []);

  if (!session || screen === "login") {
    return <LoginScreen onSignIn={(s) => { setSession(s); setScreen("home"); }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {screen !== "home" && (
            <button onClick={() => setScreen("home")} className="w-12 h-12 rounded-xl border border-border bg-muted flex items-center justify-center hover:bg-accent transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in</div>
            <div className="text-[16px] font-semibold">{session.employeeName}</div>
          </div>
        </div>
        <button onClick={() => { signOut(); setScreen("login"); }} className="inline-flex items-center gap-2 h-12 px-5 rounded-xl border border-border bg-muted hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-[13px] font-semibold">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>

      <main className="p-6">
        {screen === "home" && <HomeScreen session={session} onNavigate={setScreen} />}
        {screen === "clock" && <ClockScreen session={session} />}
        {screen === "scan-plant" && <PlantScanScreen />}
        {screen === "weigh" && <WeighScreen session={session} />}
        {screen === "tasks" && <TasksScreen session={session} />}
        {screen === "log" && <LogScreen onDone={() => setScreen("home")} />}
        {screen === "waste" && <WasteScreen />}
        {screen === "scan-batch" && <BatchScanScreen />}
      </main>
    </div>
  );
}

// ─── Login Screen ───────────────────────────────────────────────────────────
function LoginScreen({ onSignIn }: { onSignIn: (s: any) => void }) {
  const { orgId } = useOrg();
  const login = useKioskLogin();
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [facility, setFacility] = useState<string>("");
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from("grow_facilities").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name");
      setFacilities((data ?? []) as any);
      const primary = ((data ?? []) as any[])[0];
      if (primary) setFacility(primary.id);
    })();
  }, [orgId]);

  const handleDigit = (d: string) => { if (input.length < 10) setInput((v) => v + d); };
  const handleDelete = () => setInput((v) => v.slice(0, -1));
  const handleClear = () => setInput("");

  const handleSignIn = async () => {
    if (!input) { toast.error("Enter your employee number"); return; }
    setSaving(true);
    try {
      const employee = await login(input);
      if (!employee) { toast.error("Employee not found"); setSaving(false); return; }
      onSignIn({
        employeeId: employee.id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        facilityId: employee.facility_id ?? facility ?? null,
        sessionId: crypto.randomUUID(),
        signedInAt: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign in failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Leaf className="w-12 h-12 mx-auto text-primary mb-3" />
          <h1 className="text-[24px] font-bold">Cody Grow Kiosk</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Tap in to start your shift</p>
        </div>

        {facilities.length > 1 && (
          <div className="space-y-2">
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Facility</label>
            <select value={facility} onChange={(e) => setFacility(e.target.value)} className="flex h-14 w-full rounded-xl border border-border bg-card px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary">
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Employee number</label>
          <div className="h-20 rounded-2xl border-2 border-border bg-card flex items-center justify-center text-[36px] font-mono font-bold tabular-nums tracking-[0.3em]">
            {input || <span className="text-muted-foreground/40">—</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => handleDigit(d)} className="h-20 rounded-2xl border border-border bg-card hover:bg-accent active:scale-95 transition-all text-[24px] font-bold">
              {d}
            </button>
          ))}
          <button onClick={handleClear} className="h-20 rounded-2xl border border-border bg-card hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all inline-flex items-center justify-center">
            <X className="w-6 h-6" />
          </button>
          <button onClick={() => handleDigit("0")} className="h-20 rounded-2xl border border-border bg-card hover:bg-accent active:scale-95 transition-all text-[24px] font-bold">0</button>
          <button onClick={handleDelete} className="h-20 rounded-2xl border border-border bg-card hover:bg-accent active:scale-95 transition-all inline-flex items-center justify-center">
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <Button onClick={handleSignIn} disabled={!input || saving} className="w-full h-16 text-[16px] font-bold rounded-2xl">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
        </Button>
      </div>
    </div>
  );
}

// ─── Home Screen ────────────────────────────────────────────────────────────
function HomeScreen({ session, onNavigate }: { session: any; onNavigate: (s: Screen) => void }) {
  const { punch, isClockedIn } = useLatestPunch(session.employeeId);
  const { tasks } = useKioskTasks(session.employeeId);

  const shiftDuration = useMemo(() => {
    if (!isClockedIn || !punch?.punched_at) return null;
    const ms = Date.now() - new Date(punch.punched_at).getTime();
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }, [punch, isClockedIn]);

  const tiles: Array<{ screen: Screen; icon: any; label: string; color: string; badge?: string | null; subtitle?: string | null }> = [
    { screen: "clock", icon: Clock, label: isClockedIn ? "Clock Out" : "Clock In", color: isClockedIn ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500" : "bg-muted border-border text-muted-foreground", subtitle: shiftDuration },
    { screen: "scan-plant", icon: Leaf, label: "Scan Plant", color: "bg-green-500/15 border-green-500/30 text-green-500" },
    { screen: "weigh", icon: Scale, label: "Weigh", color: "bg-purple-500/15 border-purple-500/30 text-purple-500" },
    { screen: "tasks", icon: ClipboardList, label: "My Tasks", color: "bg-blue-500/15 border-blue-500/30 text-blue-500", badge: tasks.length > 0 ? String(tasks.length) : null },
    { screen: "log", icon: BookOpen, label: "Log Entry", color: "bg-teal-500/15 border-teal-500/30 text-teal-500" },
    { screen: "waste", icon: Trash2, label: "Record Waste", color: "bg-amber-500/15 border-amber-500/30 text-amber-500" },
    { screen: "scan-batch", icon: Barcode, label: "Scan Batch", color: "bg-cyan-500/15 border-cyan-500/30 text-cyan-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="text-[14px] text-muted-foreground">Welcome,</div>
        <h1 className="text-[32px] font-bold">{session.employeeName.split(" ")[0]}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <motion.button
            key={tile.screen}
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate(tile.screen)}
            className={cn("relative aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-3 p-6 transition-all hover:border-primary/50", tile.color)}
          >
            <tile.icon className="w-14 h-14" strokeWidth={1.5} />
            <div className="text-[17px] font-bold">{tile.label}</div>
            {tile.subtitle && <div className="text-[11px] font-mono opacity-80">{tile.subtitle}</div>}
            {tile.badge && (
              <div className="absolute top-4 right-4 min-w-[28px] h-7 px-2 rounded-full bg-destructive text-destructive-foreground text-[13px] font-bold flex items-center justify-center">
                {tile.badge}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Clock Screen ───────────────────────────────────────────────────────────
function ClockScreen({ session }: { session: any }) {
  const { punch, refresh, isClockedIn } = useLatestPunch(session.employeeId);
  const punchAction = useKioskPunch();
  const [saving, setSaving] = useState(false);

  const handlePunch = async () => {
    setSaving(true);
    try {
      await punchAction(session.employeeId, isClockedIn ? "out" : "in");
      toast.success(isClockedIn ? "Clocked out" : "Clocked in");
      refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center py-8">
        <div className={cn("inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-bold uppercase tracking-wider",
          isClockedIn ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground")}>
          <Clock className="w-4 h-4" /> {isClockedIn ? "Clocked In" : "Clocked Out"}
        </div>
        {punch?.punched_at && (
          <div className="text-[13px] text-muted-foreground mt-3">
            Last punch: {new Date(punch.punched_at).toLocaleString()}
          </div>
        )}
      </div>
      <Button onClick={handlePunch} disabled={saving} className={cn("w-full h-24 text-[20px] font-bold rounded-2xl", isClockedIn ? "bg-destructive hover:bg-destructive/90" : "bg-emerald-500 hover:bg-emerald-500/90")}>
        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : isClockedIn ? "Clock Out" : "Clock In"}
      </Button>
    </div>
  );
}

// ─── Plant Scan Screen ─────────────────────────────────────────────────────
function PlantScanScreen() {
  const scan = useKioskScanPlant();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);

  const handleScan = async () => {
    if (!value.trim()) return;
    setSearching(true);
    try {
      const plant = await scan(value.trim());
      setResult(plant);
      if (!plant) toast.error("Plant not found");
    } finally { setSearching(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-[22px] font-bold text-center">Scan or enter plant identifier</h2>
      <div className="flex gap-2">
        <Input
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
          placeholder="PLT-0001 or external ID" autoFocus
          className="h-16 text-[18px] font-mono text-center"
        />
        <Button onClick={handleScan} disabled={searching || !value.trim()} className="h-16 px-6">
          {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        </Button>
      </div>
      {result && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[20px] font-bold">{result.plant_identifier}</div>
            <span className="inline-flex items-center h-7 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider bg-muted text-foreground">{result.phase ?? "—"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><span className="text-muted-foreground">Strain:</span> <span className="font-semibold">{result.strain?.name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Area:</span> <span className="font-semibold">{result.area?.name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">State:</span> <span className="font-semibold">{result.ccrs_plant_state ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Source:</span> <span className="font-semibold">{result.source_type ?? "—"}</span></div>
          </div>
          <BarcodeRenderer value={result.plant_identifier ?? result.external_id} format="code128" height={48} />
        </div>
      )}
    </div>
  );
}

// ─── Batch Scan Screen ─────────────────────────────────────────────────────
function BatchScanScreen() {
  const scan = useKioskScanBatch();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);

  const handleScan = async () => {
    if (!value.trim()) return;
    setSearching(true);
    try {
      const batch = await scan(value.trim());
      setResult(batch);
      if (!batch) toast.error("Batch not found");
    } finally { setSearching(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-[22px] font-bold text-center">Scan batch barcode</h2>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }} placeholder="Batch barcode" autoFocus className="h-16 text-[18px] font-mono text-center" />
        <Button onClick={handleScan} disabled={searching || !value.trim()} className="h-16 px-6">
          {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        </Button>
      </div>
      {result && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 space-y-3">
          <div className="font-mono text-[20px] font-bold">{result.barcode}</div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><span className="text-muted-foreground">Product:</span> <span className="font-semibold">{result.product?.name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Strain:</span> <span className="font-semibold">{result.strain?.name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Available:</span> <span className="font-mono font-semibold">{Number(result.current_quantity).toFixed(0)}g</span></div>
            <div><span className="text-muted-foreground">Status:</span> <span className="font-semibold">{result.is_available ? "Available" : "Quarantined"}</span></div>
          </div>
          <BarcodeRenderer value={result.barcode} format="code128" height={48} />
        </div>
      )}
    </div>
  );
}

// ─── Weigh Screen ───────────────────────────────────────────────────────────
type WeighContext = "harvest_wet" | "harvest_dry" | "qa_sample" | "general";

function WeighScreen({ session }: { session: any }) {
  const [weight, setWeight] = useState("");
  const [context, setContext] = useState<WeighContext>("harvest_wet");
  const [harvestId, setHarvestId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const harvests = useKioskActiveHarvests();
  const recordScale = useKioskScaleReading();
  const recordWet = useRecordWetWeight();
  const recordDry = useRecordDryWeight();

  const needsHarvest = context === "harvest_wet" || context === "harvest_dry";

  const handleSave = async () => {
    const w = Number(weight || 0);
    if (w <= 0) { toast.error("Enter a weight"); return; }
    if (needsHarvest && !harvestId) { toast.error("Pick a harvest"); return; }
    setSaving(true);
    try {
      // Always record an audit-trail scale reading
      await recordScale({
        weight_grams: w,
        entity_type: context,
        entity_id: needsHarvest ? harvestId : null,
      });
      if (context === "harvest_wet" && harvestId) await recordWet(harvestId, w);
      else if (context === "harvest_dry" && harvestId) await recordDry(harvestId, w);
      toast.success(`Recorded ${w}g (${context.replace(/_/g, " ")})`);
      setWeight("");
      void session;
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-[22px] font-bold text-center">Weigh</h2>
      <div className="grid grid-cols-2 gap-3">
        {(["harvest_wet", "harvest_dry", "qa_sample", "general"] as const).map((c) => (
          <button key={c} onClick={() => setContext(c)} className={cn("h-16 rounded-2xl border-2 font-semibold text-[14px] capitalize transition-all", context === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
            {c.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      {needsHarvest && (
        <div className="space-y-2">
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Harvest</label>
          <select value={harvestId} onChange={(e) => setHarvestId(e.target.value)} className="flex h-14 w-full rounded-xl border border-border bg-card px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">— Select harvest —</option>
            {harvests.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.status}</option>)}
          </select>
        </div>
      )}
      <div className="relative">
        <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" step="0.1" placeholder="0.0" className="h-32 text-[64px] font-mono text-center" />
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[24px] text-muted-foreground">g</span>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center text-[12px]">
        Bluetooth scale integration coming soon — enter weight manually for now.
      </div>
      <Button disabled={!weight || saving || (needsHarvest && !harvestId)} className="w-full h-16 text-[16px] font-bold rounded-2xl" onClick={handleSave}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Record Weight"}
      </Button>
    </div>
  );
}

// ─── Tasks Screen ───────────────────────────────────────────────────────────
function TasksScreen({ session }: { session: any }) {
  const { tasks, refresh } = useKioskTasks(session.employeeId);
  const complete = useCompleteTask();

  if (tasks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
        <h2 className="text-[22px] font-bold">No tasks today</h2>
        <p className="text-[14px] text-muted-foreground mt-2">Nice work!</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h2 className="text-[22px] font-bold text-center mb-6">{tasks.length} task{tasks.length === 1 ? "" : "s"}</h2>
      <AnimatePresence>
        {tasks.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }}
            className="rounded-2xl border-2 border-border bg-card p-5 flex items-center gap-4"
          >
            <button
              onClick={async () => { try { await complete(t.id); toast.success("Done!"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}
              className="w-12 h-12 rounded-full border-2 border-border bg-background hover:bg-emerald-500 hover:border-emerald-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <CheckCircle2 className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold truncate">{t.title}</div>
              {t.scheduled_end && <div className="text-[12px] text-muted-foreground mt-0.5">Due {new Date(t.scheduled_end).toLocaleDateString()}</div>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Log Screen ─────────────────────────────────────────────────────────────
function LogScreen({ onDone }: { onDone: () => void }) {
  const { orgId } = useOrg();
  const createLog = useKioskLog();
  const [areaId, setAreaId] = useState("");
  const [content, setContent] = useState("");
  const [logType, setLogType] = useState("general");
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name");
      setAreas((data ?? []) as any);
    })();
  }, [orgId]);

  const handleSave = async () => {
    if (!content.trim()) { toast.error("Add a note"); return; }
    setSaving(true);
    try {
      await createLog({ area_id: areaId || null, content: content.trim(), log_type: logType });
      toast.success("Log saved");
      onDone();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-[22px] font-bold text-center">New log entry</h2>
      <div className="grid grid-cols-2 gap-3">
        {areas.slice(0, 8).map((a) => (
          <button key={a.id} onClick={() => setAreaId(a.id)} className={cn("h-16 rounded-2xl border-2 font-semibold text-[14px] transition-all", areaId === a.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
            {a.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {["general", "observation", "feeding", "ipm", "issue"].map((t) => (
          <button key={t} onClick={() => setLogType(t)} className={cn("h-12 px-5 rounded-full border-2 font-semibold text-[12px] capitalize transition-all", logType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
            {t}
          </button>
        ))}
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="w-full rounded-2xl border-2 border-border bg-card p-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="What did you observe?" />
      <Button onClick={handleSave} disabled={!content.trim() || saving} className="w-full h-16 text-[16px] font-bold rounded-2xl">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Log"}
      </Button>
    </div>
  );
}

// ─── Waste Screen ───────────────────────────────────────────────────────────
function WasteScreen() {
  const [wasteType, setWasteType] = useState<"plant" | "inventory" | null>(null);
  const [weight, setWeight] = useState("");
  const [reason, setReason] = useState<string>("");
  const [method, setMethod] = useState<CcrsDestructionMethod>("Compost");
  const [inventoryReason, setInventoryReason] = useState<string>("Destruction");
  const scanPlant = useKioskScanPlant();
  const scanBatch = useKioskScanBatch();
  const destroyPlant = useDestroyPlant();
  const adjustWaste = useKioskRecordInventoryWaste();
  const [entityInput, setEntityInput] = useState("");
  const [entity, setEntity] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const lookupEntity = async () => {
    if (!entityInput.trim() || !wasteType) return;
    const e = wasteType === "plant" ? await scanPlant(entityInput.trim()) : await scanBatch(entityInput.trim());
    if (!e) { toast.error(`${wasteType} not found`); return; }
    setEntity(e);
  };

  const handleSave = async () => {
    if (!entity || !weight) return;
    const w = Number(weight);
    if (w <= 0) { toast.error("Enter weight"); return; }
    setSaving(true);
    try {
      if (wasteType === "plant") {
        if (!reason) { toast.error("Pick a reason"); setSaving(false); return; }
        await destroyPlant([entity.id], {
          reason: reason as CcrsDestructionReason,
          method,
          pre_disposal_weight_grams: w,
          notes: "Recorded via kiosk",
        });
        toast.success(`Plant destroyed · ${w}g`);
      } else {
        await adjustWaste({
          batch_id: entity.id,
          weight_grams: w,
          reason: inventoryReason,
          detail: "Recorded via kiosk",
        });
        toast.success(`Inventory waste recorded · ${w}g`);
      }
      setEntity(null); setEntityInput(""); setWeight(""); setReason("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  if (!wasteType) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h2 className="text-[22px] font-bold text-center">Record Waste</h2>
        <p className="text-[13px] text-muted-foreground text-center">What type of waste?</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setWasteType("plant")} className="aspect-square rounded-3xl border-2 border-green-500/30 bg-green-500/10 text-green-500 flex flex-col items-center justify-center gap-3">
            <Leaf className="w-14 h-14" strokeWidth={1.5} />
            <div className="text-[17px] font-bold">Plant Waste</div>
          </button>
          <button onClick={() => setWasteType("inventory")} className="aspect-square rounded-3xl border-2 border-amber-500/30 bg-amber-500/10 text-amber-500 flex flex-col items-center justify-center gap-3">
            <Trash2 className="w-14 h-14" strokeWidth={1.5} />
            <div className="text-[17px] font-bold">Inventory Waste</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setWasteType(null); setEntity(null); setEntityInput(""); setWeight(""); }} className="w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[18px] font-bold">{wasteType === "plant" ? "Plant" : "Inventory"} Waste</h2>
      </div>

      {!entity ? (
        <div className="space-y-3">
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Scan or enter {wasteType === "plant" ? "plant identifier" : "batch barcode"}
          </label>
          <div className="flex gap-2">
            <Input value={entityInput} onChange={(e) => setEntityInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") lookupEntity(); }} autoFocus className="h-16 text-[18px] font-mono text-center" />
            <Button onClick={lookupEntity} disabled={!entityInput.trim()} className="h-16 px-6">Find</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="font-mono text-[16px] font-bold">{wasteType === "plant" ? entity.plant_identifier : entity.barcode}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {wasteType === "plant"
                ? `${entity.strain?.name ?? "—"} · ${entity.area?.name ?? "—"} · ${entity.phase ?? "—"}`
                : `${entity.product?.name ?? "—"} · ${Number(entity.current_quantity ?? 0).toFixed(0)}g available`}
            </div>
          </div>

          {wasteType === "plant" ? (
            <>
              <div className="space-y-2">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reason</label>
                <div className="grid grid-cols-2 gap-2">
                  {CCRS_DESTRUCTION_REASONS.map((r) => (
                    <button key={r} onClick={() => setReason(r)} className={cn("h-12 rounded-xl border-2 font-semibold text-[12px] transition-all", reason === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {CCRS_DESTRUCTION_METHODS.map((m) => (
                    <button key={m} onClick={() => setMethod(m)} className={cn("h-12 rounded-xl border-2 font-semibold text-[12px] transition-all", method === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reason</label>
              <div className="grid grid-cols-2 gap-2">
                {CCRS_ADJUSTMENT_REASONS.map((r) => (
                  <button key={r} onClick={() => setInventoryReason(r)} className={cn("h-12 rounded-xl border-2 font-semibold text-[12px] transition-all", inventoryReason === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" step="0.1" placeholder="0.0" className="h-28 text-[56px] font-mono text-center" />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">g</span>
          </div>
          <Button disabled={!weight || saving || (wasteType === "plant" && !reason)} onClick={handleSave} className="w-full h-16 text-[16px] font-bold rounded-2xl bg-amber-500 hover:bg-amber-500/90">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Record Waste"}
          </Button>
        </div>
      )}
    </div>
  );
}
