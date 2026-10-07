'use client';

import { ShieldCheck, AlertTriangle, Zap, Target, TrendingUp, CheckCircle2 } from 'lucide-react';

interface Countermeasure {
  id: string;
  title: string;
  effort: 'LOW' | 'HIGH';
  impact: 'LOW' | 'HIGH';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
}

interface AnalyticsProps {
  countermeasures: Countermeasure[];
  totalIncidents: number;
  passedTestsCount: number;
  totalTestsCount: number;
}

export const PriorityMatrixAndAnalytics: React.FC<AnalyticsProps> = ({
  countermeasures,
  totalIncidents,
  passedTestsCount,
  totalTestsCount,
}) => {
  const quickWins = countermeasures.filter((c) => c.effort === 'LOW' && c.impact === 'HIGH');
  const majorProjects = countermeasures.filter((c) => c.effort === 'HIGH' && c.impact === 'HIGH');
  const fillIns = countermeasures.filter((c) => c.effort === 'LOW' && c.impact === 'LOW');
  const hardSlogs = countermeasures.filter((c) => c.effort === 'HIGH' && c.impact === 'LOW');

  const testPassRate = totalTestsCount > 0 ? Math.round((passedTestsCount / totalTestsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* --- DASHBOARD WIDGETS "ABUSED" METRICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: System Health / Verification Rate */}
        <div className="bg-secondary/50 border border-border rounded-xl p-4 text-foreground relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10">
            <ShieldCheck size={80} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Logical Integrity Score</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-3xl font-bold text-success">{testPassRate}%</span>
            <span className="text-xs text-muted-foreground">({passedTestsCount}/{totalTestsCount} Test Lulus)</span>
          </div>
          <div className="w-full bg-muted h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-success h-full transition-all duration-500"
              style={{ width: `${testPassRate}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Quick Wins Available */}
        <div className="bg-secondary/50 border border-border rounded-xl p-4 text-foreground relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10 text-warning">
            <Zap size={80} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">High Impact / Low Effort</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-3xl font-bold text-warning">{quickWins.length}</span>
            <span className="text-xs text-muted-foreground">Aksi &quot;Quick Wins&quot;</span>
          </div>
          <p className="text-xs text-warning/80 mt-3 flex items-center gap-1">
            <Zap size={12} /> Priority eksekusi tinggi!
          </p>
        </div>

        {/* Metric 3: Closed-Loop Traceability Rate */}
        <div className="bg-secondary/50 border border-border rounded-xl p-4 text-foreground relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10 text-primary">
            <Target size={80} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Incident-to-CAPA Coverage</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-3xl font-bold text-primary">
              {totalIncidents > 0 ? Math.round((countermeasures.length / totalIncidents) * 100) : 0}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Terkoneksi ke Root Cause RCA</p>
        </div>

        {/* Metric 4: CAPA Velocity / Completion */}
        <div className="bg-secondary/50 border border-border rounded-xl p-4 text-foreground relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10 text-primary">
            <TrendingUp size={80} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Verified Countermeasures</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-3xl font-bold text-primary">
              {countermeasures.filter((c) => c.status === 'VERIFIED').length}
            </span>
            <span className="text-xs text-muted-foreground">/ {countermeasures.length} Total Aksi</span>
          </div>
          <p className="text-xs text-success mt-3 flex items-center gap-1">
            <CheckCircle2 size={12} /> Tervalidasi Sistem
          </p>
        </div>
      </div>

      {/* --- VISUAL PRIORITY MATRIX (2x2 QUADRANT) --- */}
      <div className="bg-secondary/50 border border-border rounded-xl p-6 text-foreground">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="text-primary" size={20} /> Impact vs Effort Prioritization Matrix
            </h3>
            <p className="text-xs text-muted-foreground">Pemetaan otomatis aksi perbaikan untuk efisiensi eksekusi</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-background p-4 rounded-xl border border-border relative">
          {/* Axis Labels */}
          <div className="absolute -left-3 top-1/2 -rotate-90 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
            IMPACT (High ↑)
          </div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
            EFFORT (High →)
          </div>

          {/* Quadrant 1: Quick Wins */}
          <div className="bg-success/10 border border-success/30 rounded-lg p-3 min-h-[140px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-success flex items-center gap-1">
                <Zap size={14} /> 1. QUICK WINS
              </span>
              <span className="text-[10px] bg-success/15 text-success px-2 py-0.5 rounded-full">
                High Impact, Low Effort
              </span>
            </div>
            <ul className="space-y-1">
              {quickWins.map((item) => (
                <li key={item.id} className="text-xs bg-secondary/40 p-1.5 rounded border border-success/20 truncate">
                  • {item.title}
                </li>
              ))}
              {quickWins.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Tidak ada item</p>}
            </ul>
          </div>

          {/* Quadrant 2: Major Projects */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 min-h-[140px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-primary">2. MAJOR PROJECTS</span>
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                High Impact, High Effort
              </span>
            </div>
            <ul className="space-y-1">
              {majorProjects.map((item) => (
                <li key={item.id} className="text-xs bg-secondary/40 p-1.5 rounded border border-primary/20 truncate">
                  • {item.title}
                </li>
              ))}
              {majorProjects.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Tidak ada item</p>}
            </ul>
          </div>

          {/* Quadrant 3: Fill-ins */}
          <div className="bg-secondary/30 border border-border/50 rounded-lg p-3 min-h-[140px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-muted-foreground">3. FILL-INS</span>
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Low Impact, Low Effort
              </span>
            </div>
            <ul className="space-y-1">
              {fillIns.map((item) => (
                <li key={item.id} className="text-xs bg-secondary/40 p-1.5 rounded border border-border/50 truncate">
                  • {item.title}
                </li>
              ))}
              {fillIns.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Tidak ada item</p>}
            </ul>
          </div>

          {/* Quadrant 4: Hard Slogs / Re-evaluate */}
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 min-h-[140px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-warning flex items-center gap-1">
                <AlertTriangle size={14} /> 4. HARD SLOGS
              </span>
              <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full">
                Low Impact, High Effort
              </span>
            </div>
            <ul className="space-y-1">
              {hardSlogs.map((item) => (
                <li key={item.id} className="text-xs bg-secondary/40 p-1.5 rounded border border-warning/20 truncate">
                  • {item.title}
                </li>
              ))}
              {hardSlogs.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Tidak ada item</p>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriorityMatrixAndAnalytics;
