import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Leaf, CalendarDays, Scissors, Package, ShieldCheck,
  ArrowRight, Sprout, FlaskConical, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import StatCard from "@/components/shared/StatCard";
import PageHeader from "@/components/shared/PageHeader";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";

const gettingStarted = [
  { icon: Settings, title: "Configure Strains & Areas", description: "Set up your strain library and grow areas before adding plants.", to: "/settings" },
  { icon: Sprout, title: "Add Your First Plants", description: "Start tracking plants from seed or clone.", to: "/cultivation/plants" },
  { icon: CalendarDays, title: "Create a Grow Cycle", description: "Group plants into grow cycles for batch tracking.", to: "/cultivation/grow-cycles" },
  { icon: FlaskConical, title: "Set Up Lab Testing", description: "Configure your lab partners for compliance testing.", to: "/inventory/lab-testing" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Welcome to Cody Grow"
        description={`Signed in as ${user?.email}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <StatCard label="Active Plants" value={0} accentClass="stat-accent-teal" delay={0} />
        <StatCard label="In Flower" value={0} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Upcoming Harvests" value={0} accentClass="stat-accent-amber" delay={0.1} />
        <StatCard label="Active Grow Cycles" value={0} accentClass="stat-accent-blue" delay={0.15} />
        <StatCard label="CCRS Status" value="--" accentClass="stat-accent-teal" delay={0.2} />
      </div>

      {/* Cody Insights */}
      <div className="mb-8">
        <CodyInsightsPanel limit={5} />
      </div>

      {/* Getting Started */}
      <div className="mb-8">
        <h2 className="text-[15px] font-semibold text-foreground mb-4">Getting Started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gettingStarted.map((item, i) => (
            <motion.button
              key={item.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => navigate(item.to)}
              className="group flex items-start gap-4 p-5 rounded-xl border border-border bg-card text-left transition-all duration-200 hover:shadow-lg hover:border-primary/20 card-hover"
              style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold text-foreground mb-0.5 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
