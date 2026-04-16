import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Sparkles, Mic, RotateCcw } from "lucide-react";
import codyIcon from "@/assets/cody-icon.svg";
import { useAskCody } from "@/hooks/useAskCody";
import { cn } from "@/lib/utils";

function MessageBubble({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "flex w-full gap-2.5",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      {role === "assistant" && (
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <img src={codyIcon} alt="" className="w-3.5 h-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
          role === "user"
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-bl-sm",
        )}
      >
        {pending ? (
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0.3s" }} />
          </span>
        ) : (
          content
        )}
      </div>
    </motion.div>
  );
}

export default function AskCody() {
  const location = useLocation();
  const pageKey = location.pathname;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sending, send, reset } = useAskCody({ pageKey });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    send(input);
    setInput("");
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 25 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 group"
        title="Ask Cody"
      >
        <div className="relative">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-md group-hover:bg-primary/50 transition-colors" />
          <div className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg fab-pulse hover:scale-110 transition-transform">
            <img src={codyIcon} alt="" className="w-7 h-7" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
        </div>
      </motion.button>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] flex flex-col"
              style={{
                background: "hsl(var(--card))",
                borderLeft: "1px solid var(--glass-border)",
                boxShadow: "0 0 60px var(--shadow-heavy)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/30 blur-sm" />
                    <img src={codyIcon} alt="" className="relative w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-semibold text-foreground leading-none">Ask Cody</h2>
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">AI assistant for your grow</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={reset}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="New conversation"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message list */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl scale-150" />
                      <div className="relative w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-[14px] font-semibold text-foreground mb-1">How can I help?</h3>
                    <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[260px]">
                      Ask me about your plants, grow cycles, harvests, batches, lab results, or compliance status.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <MessageBubble key={i} role={m.role} content={m.content} pending={m.pending} />
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-3 shrink-0" style={{ borderTop: "1px solid var(--glass-border)" }}>
                <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Ask Cody about your grow..."
                    rows={1}
                    className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 resize-none focus:outline-none max-h-32"
                    disabled={sending}
                  />
                  <button
                    type="button"
                    title="Voice input (coming soon)"
                    disabled
                    className="p-1.5 rounded-md text-muted-foreground/50 cursor-not-allowed shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
