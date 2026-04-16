import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import codyIcon from "@/assets/cody-icon.svg";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [session, loading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signUp(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
    else navigate("/dashboard", { replace: true });
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
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="flex flex-col items-center justify-center mb-8">
          <img src={codyIcon} alt="" className="h-14 w-auto mb-2" />
          <span className="text-[28px] font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            <span style={{ color: "#00D4AA" }}>c</span><span className="text-gray-900 dark:text-white">ody</span>
          </span>
        </div>

        <div className="rounded-xl p-6 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700/50 shadow-xl shadow-gray-200/50 dark:shadow-black/30">
          <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Create your account</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">Get started with Cody Grow</p>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</label>
              <Input type="email" placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required disabled={submitting}
                className="h-10 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-[14px] placeholder:text-gray-400" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Password</label>
              <Input type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required disabled={submitting}
                className="h-10 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-[14px] placeholder:text-gray-400" />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-[12px] rounded-md px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </motion.div>
            )}

            <Button type="submit" disabled={submitting}
              className="w-full h-10 mt-2 font-medium text-[14px] gap-2 bg-[#006B55] text-white hover:bg-[#005643]">
              {submitting ? (
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[13px] text-gray-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-[#006B55] font-medium hover:text-[#005643] transition-colors">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
