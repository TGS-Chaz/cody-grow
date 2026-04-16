import { useEffect, useRef, useState, createContext, useContext, ReactNode, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

export interface Shortcut {
  keys: string[];
  description: string;
  /** Optional: scope label to group by */
  scope?: string;
}

interface ShortcutsContextValue {
  register: (shortcut: Shortcut) => () => void;
  all: Shortcut[];
  show: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<Shortcut[]>([]);
  const [open, setOpen] = useState(false);

  const register = useCallback((shortcut: Shortcut) => {
    setRegistered((prev) => [...prev, shortcut]);
    return () => setRegistered((prev) => prev.filter((s) => s !== shortcut));
  }, []);

  const show = useCallback(() => setOpen(true), []);

  // Listen for ? key to open modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isEditable) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, Shortcut[]>();
    for (const s of registered) {
      const scope = s.scope ?? "Page";
      if (!map.has(scope)) map.set(scope, []);
      map.get(scope)!.push(s);
    }
    return map;
  }, [registered]);

  // CRITICAL: memoize the context value so its reference is stable across renders
  // when only unrelated local state (like `open`) changes.
  // Without this, every re-render creates a new object, which breaks consumers
  // that depend on `ctx` as an effect dep — causing infinite register/unregister loops.
  const ctxValue = useMemo<ShortcutsContextValue>(
    () => ({ register, all: registered, show }),
    [register, registered, show],
  );

  return (
    <ShortcutsContext.Provider value={ctxValue}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 h-12 border-b border-border">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-primary" />
                  <h2 className="text-[13px] font-semibold">Keyboard shortcuts</h2>
                </div>
                <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                {grouped.size === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No shortcuts registered on this page.</p>
                ) : (
                  Array.from(grouped.entries()).map(([scope, shortcuts]) => (
                    <div key={scope}>
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{scope}</h3>
                      <div className="space-y-1.5">
                        {shortcuts.map((s, i) => (
                          <div key={i} className="flex items-center justify-between text-[12px]">
                            <span className="text-foreground">{s.description}</span>
                            <span className="flex items-center gap-1">
                              {s.keys.map((k, j) => (
                                <span key={j} className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-border bg-muted/40 font-mono text-[10px] text-foreground">
                                  {k}
                                </span>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ShortcutsContext.Provider>
  );
}

/**
 * Register a keyboard shortcut. Handler runs when the key combination fires.
 * Does NOT run while user is typing in an input/textarea.
 *
 * CRITICAL DESIGN: We depend only on the stable `register` function ref,
 * NOT on the entire context object. If we depended on `ctx`, every Provider
 * re-render (triggered by setRegistered) would change the ctx object reference,
 * causing this effect to re-run, causing another register/unregister cycle —
 * an infinite loop.
 *
 * We also stash `handler` in a ref so changing the handler closure doesn't
 * re-attach the keyboard listener on every render.
 */
export function useShortcut(
  keys: string[],
  handler: (e: KeyboardEvent) => void,
  options: { description?: string; scope?: string; enabled?: boolean } = {},
) {
  const ctx = useContext(ShortcutsContext);
  const register = ctx?.register; // stable useCallback — safe to use as dep
  const { description, scope, enabled = true } = options;

  // Keep the latest handler in a ref so the listener effect can call it
  // without being re-subscribed on every render.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const keysKey = keys.join("+");

  // Register for the cheat sheet — depends only on primitives + stable register ref
  useEffect(() => {
    if (!register || !description || !enabled) return;
    const unregister = register({ keys, description, scope });
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, description, scope, keysKey, enabled]);

  // Listen for keypresses — attach once per (keys, enabled) change
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const isCombo = e.metaKey || e.ctrlKey;
      if (isEditable && !isCombo && e.key !== "Escape") return;

      const pressed: string[] = [];
      if (e.metaKey || e.ctrlKey) pressed.push("⌘");
      if (e.altKey) pressed.push("Alt");
      if (e.shiftKey && e.key.length > 1) pressed.push("Shift");
      pressed.push(e.key);

      const lower = pressed.map((k) => k.toLowerCase()).join("+");
      const target_ = keys.map((k) => k.toLowerCase()).join("+");
      if (lower === target_) {
        e.preventDefault();
        handlerRef.current(e);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey, enabled]);
}

export function useShortcutsContext() {
  return useContext(ShortcutsContext);
}

/** Small inline keyboard-key display */
export function ShortcutHint({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k, i) => (
        <span key={i} className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-border bg-muted/40 font-mono text-[10px] text-muted-foreground">
          {k}
        </span>
      ))}
    </span>
  );
}
