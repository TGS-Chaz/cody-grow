import { motion } from "framer-motion";
import { Lock, Mail, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import codyIcon from "@/assets/cody-icon.svg";

export default function NoAccessPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0A0E17] px-4">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.06] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #00D4AA 0%, transparent 70%)", filter: "blur(100px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-1.5 mb-10">
          <img src={codyIcon} alt="" className="h-8 w-auto" />
          <span className="text-[28px] font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            <span style={{ color: "#00D4AA" }}>c</span><span className="text-gray-900 dark:text-white">ody</span>
            <span className="ml-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
              style={{ background: "hsl(168 100% 42% / 0.12)", color: "#00D4AA" }}>
              grow
            </span>
          </span>
        </div>

        {/* Card */}
        <div className="rounded-xl p-8 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700/50 shadow-xl shadow-gray-200/50 dark:shadow-black/30 text-center">
          <div className="w-14 h-14 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6 text-[#006B55]" />
          </div>

          <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white mb-2">
            No access to Cody Grow
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
            Your organization doesn't have access to Cody Grow yet. Reach out to sales to add it to your subscription.
          </p>

          {user?.email && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">
              Signed in as <span className="font-medium text-gray-600 dark:text-gray-300">{user.email}</span>
            </p>
          )}

          <div className="space-y-2">
            <Button asChild className="w-full h-10 font-medium text-[14px] gap-2 bg-[#006B55] text-white hover:bg-[#005643]">
              <a href="mailto:sales@cody.com?subject=Cody Grow access request">
                <Mail className="w-4 h-4" /> Request Access
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full h-10 font-medium text-[14px] gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
