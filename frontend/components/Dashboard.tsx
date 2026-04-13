import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { apiClient } from "../services/api";
import { CaseReport, CaseStatus } from "../types";


const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#a855f7"];


export const Dashboard: React.FC = () => {
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotspotData, setHotspotData] = useState<{
    by_province: { name: string; total: number }[];
    critical_hotspots: { institution: string; total: number }[];
  } | null>(null);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await apiClient.getReports();
        if (response?.success && Array.isArray(response.data)) {
          setCases(
            response.data.map((r: any) => ({
              id: r.case_id || r.id,
              case_id: r.case_id,
              timestamp: r.created_at,
              type: r.type,
              status: r.status,
              riskScore: r.risk_score,
              priority: r.priority,
              institution: r.institution,
              description: r.description || "",
              location: r.location || "",
              reporterId: r.user_id,
              referenceCode: r.reference_code,
            })),
          );
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  useEffect(() => {
    const fetchHotspots = async () => {
      try {
        const response = await apiClient.getHotspots();
        if (response?.success) {
          setHotspotData({
            by_province: response.data.by_province,
            critical_hotspots: response.data.critical_hotspots,
          });
        }
      } catch (err) {
        console.error("Hotspot fetch error:", err);
      }
    };
    fetchHotspots();
  }, []);

  const stats = [
    {
      label: "Total Reports",
      value: cases.length,
      icon: "📄",
      color: "text-slate-900 dark:text-white",
    },
    {
      label: "Active Pipeline",
      value: cases.filter((c) => !["CLOSED", "DISPUTED"].includes(c.status))
        .length,
      icon: "⚡",
      color: "text-slate-900 dark:text-white",
    },
    {
      label: "Integrity Alerts",
      value: cases.filter((c) => c.status === CaseStatus.DISPUTED).length,
      icon: "🚨",
      color: "text-rose-400",
    },
    {
      label: "Finalized Dossiers",
      value: cases.filter((c) => c.status === CaseStatus.CLOSED).length,
      icon: "✅",
      color: "text-slate-900 dark:text-white",
    },
  ];

  const anchoredCount = cases.filter((c: any) =>
    Boolean(c.blockchain_tx_hash),
  ).length;
  const anchoredRate =
    cases.length > 0 ? Math.round((anchoredCount / cases.length) * 100) : 0;
  const closedCount = cases.filter(
    (c) => c.status === CaseStatus.CLOSED,
  ).length;
  const disputeCount = cases.filter(
    (c) => c.status === CaseStatus.DISPUTED,
  ).length;
  const confidenceIndex =
    closedCount > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((closedCount - disputeCount) / closedCount) * 100),
          ),
        )
      : 100;

  const distributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach((c) => {
      counts[c.type] = (counts[c.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [cases]);

  const trendData = [
    { name: "Week 1", value: 12 },
    { name: "Week 2", value: 18 },
    { name: "Week 3", value: 15 },
    { name: "Week 4", value: Math.max(cases.length, 1) },
  ];

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`glass-card p-6 rounded-3xl transition-all duration-300 border-l-4 ${stat.label === "Integrity Alerts" && stat.value > 0 ? "border-l-rose-500" : "border-l-transparent"}`}
          >
            
            <p className={`text-3xl font-bold mb-1 ${stat.color}`}>
              {loading ? "—" : stat.value}
            </p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-card p-8 rounded-4xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Engagement Activity
            </h3>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase">
                Live Intelligence
              </span>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 glass-card p-6 rounded-4xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Type Distribution
          </h3>
          {distributionData.length > 0 ? (
            <>
              <div className="h-[160px] mb-4">
                <ResponsiveContainer width="100%" height="100%" minWidth={220} minHeight={140}>
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {distributionData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {distributionData.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      ></div>
                      <span className="text-xs text-slate-400 font-medium truncate max-w-[120px]">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm text-center py-10">
              No data yet.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-6 border border-emerald-300/30 dark:border-emerald-500/20">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Blockchain Integrity
          </p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {anchoredRate}%
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            {anchoredCount} of {cases.length} reports are anchored with
            blockchain proof records.
          </p>
        </div>
        <div className="glass-card rounded-3xl p-6 border border-indigo-300/30 dark:border-indigo-500/20">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Public Confidence Index
          </p>
          <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {confidenceIndex}%
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Derived from finalized outcomes versus disputed outcomes to show
            process stability.
          </p>
        </div>
      </div>

      {/* Corruption Hotspots Preview */}
      {hotspotData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Top Provinces
              </h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Corruption Hotspots
              </span>
            </div>
            <div className="space-y-2">
              {hotspotData.by_province
                .filter((p) => p.total > 0)
                .slice(0, 5)
                .map((province, i) => {
                  const maxVal = Math.max(
                    ...hotspotData.by_province.map((p) => p.total),
                    1,
                  );
                  const pct = Math.round((province.total / maxVal) * 100);
                  return (
                    <div
                      key={province.name}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs font-black text-slate-400 w-5">
                        #{i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {province.name}
                          </span>
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                            {province.total}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct > 70 ? "bg-rose-500" : pct > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {hotspotData.by_province.filter((p) => p.total > 0).length ===
                0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  No location data available.
                </p>
              )}
            </div>
          </div>

          {hotspotData.critical_hotspots.length > 0 && (
            <div className="glass-card rounded-3xl p-6 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🚨</span>
                <h3 className="text-sm font-black text-rose-500 uppercase tracking-wider">
                  Critical Hotspots
                </h3>
              </div>
              <div className="space-y-2">
                {hotspotData.critical_hotspots.map((hs, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/20"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                      {hs.institution}
                    </span>
                    <span className="text-sm font-black text-rose-500 flex-shrink-0 ml-2">
                      {hs.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
