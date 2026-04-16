import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, AlertCircle, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import codyIcon from "@/assets/cody-icon.svg";

export default function RequestAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!licenseType) { setError("Please select your license type."); return; }
    setSubmitting(true);
    // Will wire up to Supabase when beta_requests table is created
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1000);
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
        <div className="flex items-center justify-center gap-1.5 mb-8">
          <img src={codyIcon} alt="" className="h-8 w-auto" />
          <span className="text-[28px] font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            <span style={{ color: "#00D4AA" }}>c</span><span className="text-gray-900 dark:text-white">ody</span>
          </span>
        </div>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-center mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-[#006B55]/8 text-[#006B55] border border-[#006B55]/15">
            <Shield className="w-3 h-3" /> Early Access
          </span>
        </motion.div>

        <div className="rounded-xl p-6 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700/50 shadow-xl shadow-gray-200/50 dark:shadow-black/30">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-[#006B55]" />
              </div>
              <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-2">You're on the list!</h2>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Thanks for your interest in Cody Grow. We'll reach out within 24 hours.
              </p>
            </motion.div>
          ) : (
            <>
              <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Request Early Access</h1>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">Cody Grow for WA cannabis licensees.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required disabled={submitting}
                    className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Work Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required disabled={submitting}
                    className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Company Name</label>
                  <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your company" disabled={submitting}
                    className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">License Type</label>
                  <select value={licenseType} onChange={e => setLicenseType(e.target.value)} disabled={submitting}
                    className="flex h-9 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-1 text-sm text-gray-900 dark:text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D4AA] disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="">Select license type</option>
                    <option value="producer">Producer</option>
                    <option value="processor">Processor</option>
                    <option value="producer-processor">Producer/Processor</option>
                    <option value="retailer">Retailer</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-[12px] rounded-md px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <Button type="submit" disabled={submitting} className="w-full h-10 mt-2 font-medium text-[14px] gap-2 bg-[#006B55] text-white hover:bg-[#005643]">
                  {submitting ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <>Request Early Access <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[13px] text-gray-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-[#006B55] font-medium hover:text-[#005643] transition-colors">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
