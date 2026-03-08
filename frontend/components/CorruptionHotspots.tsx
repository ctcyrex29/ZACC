import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
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

const COLORS = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#8b5cf6",
];

const priorityColor = (p: string) => {
  if (p === "CRITICAL") return "bg-rose-500";
  if (p === "HIGH") return "bg-orange-500";
  if (p === "MEDIUM") return "bg-amber-500";
  return "bg-emerald-500";
};

interface ProvinceData {
  name: string;
  total: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

interface InstitutionData {
  name: string;
  total: number;
  details: {
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    avg_risk_score: number;
  };
}

interface HotspotData {
  by_province: ProvinceData[];
  by_institution: InstitutionData[];
  by_type: { name: string; total: number }[];
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  trend: {
    recent_30_days: number;
    previous_30_days: number;
    change_percent: number;
  };
  critical_hotspots: { institution: string; total: number }[];
  total_reports: number;
}

type DetailView = "provinces" | "institutions" | "types" | null;

export const CorruptionHotspots: React.FC = () => {
  const [data, setData] = useState<HotspotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [selectedProvince, setSelectedProvince] = useState<ProvinceData | null>(
    null,
  );
  const [selectedInstitution, setSelectedInstitution] =
    useState<InstitutionData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await apiClient.getHotspots();
        if (response?.success) setData(response.data);
      } catch (err) {
        console.error("Hotspot fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 font-semibold">
            Loading hotspot data...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        Failed to load hotspot data.
      </div>
    );
  }

  const maxProvince = Math.max(...data.by_province.map((p) => p.total), 1);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-xl">📍</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {data.total_reports}
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Total Reports
          </p>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-xl">🔥</p>
          <p className="text-2xl font-black text-rose-500 mt-2">
            {data.critical_hotspots.length}
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Critical Hotspots
          </p>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-xl">📈</p>
          <p className="text-2xl font-black mt-2">
            <span
              className={
                data.trend.change_percent > 0
                  ? "text-rose-500"
                  : "text-emerald-500"
              }
            >
              {data.trend.change_percent > 0 ? "+" : ""}
              {data.trend.change_percent}%
            </span>
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            30-Day Trend
          </p>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-xl">🏢</p>
          <p className="text-2xl font-black text-indigo-500 mt-2">
            {data.by_institution.length}
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Institutions Flagged
          </p>
        </div>
      </div>

      {/* Province Heatmap */}
      <div className="glass-card p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Corruption by Province
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Zimbabwe's 10 provinces ranked by report volume
            </p>
          </div>
          <button
            onClick={() =>
              setDetailView(detailView === "provinces" ? null : "provinces")
            }
            className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {detailView === "provinces" ? "Collapse" : "Expand All"}
          </button>
        </div>

        <div className="space-y-3">
          {data.by_province.map((province, i) => {
            const pct =
              maxProvince > 0
                ? Math.round((province.total / maxProvince) * 100)
                : 0;
            const isSelected = selectedProvince?.name === province.name;
            return (
              <div key={province.name}>
                <button
                  onClick={() =>
                    setSelectedProvince(isSelected ? null : province)
                  }
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-emerald-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-400 w-5">
                        #{i + 1}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {province.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {province.total}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        cases
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct > 70
                          ? "bg-rose-500"
                          : pct > 40
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </button>

                {/* Province detail */}
                {isSelected && province.total > 0 && (
                  <div className="ml-8 mt-2 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                    {Object.keys(province.by_type).length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                          By Type
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(province.by_type).map(
                            ([type, count]) => (
                              <span
                                key={type}
                                className="px-2.5 py-1 rounded-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                              >
                                {type}: {count}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    {Object.keys(province.by_priority).length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                          By Priority
                        </p>
                        <div className="flex gap-2">
                          {Object.entries(province.by_priority).map(
                            ([priority, count]) => (
                              <div
                                key={priority}
                                className="flex items-center gap-1.5"
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${priorityColor(priority)}`}
                                ></div>
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                  {priority}: {count}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns: Top Institutions + Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Institutions */}
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Top Institutions
          </h3>
          <div className="space-y-2">
            {data.by_institution.slice(0, 10).map((inst, i) => {
              const isSelected = selectedInstitution?.name === inst.name;
              return (
                <div key={inst.name}>
                  <button
                    onClick={() =>
                      setSelectedInstitution(isSelected ? null : inst)
                    }
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border text-left ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500/30"
                        : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-indigo-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-slate-400 flex-shrink-0">
                        #{i + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {inst.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {inst.total}
                      </span>
                      {inst.details.avg_risk_score > 70 && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </div>
                  </button>

                  {isSelected && (
                    <div className="ml-6 mt-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Avg Risk:
                        </span>
                        <span
                          className={`text-sm font-black ${inst.details.avg_risk_score > 70 ? "text-rose-500" : inst.details.avg_risk_score > 40 ? "text-amber-500" : "text-emerald-500"}`}
                        >
                          {inst.details.avg_risk_score}%
                        </span>
                      </div>
                      {Object.keys(inst.details.by_status).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(inst.details.by_status).map(
                            ([s, c]) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                              >
                                {s}: {c}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Type Distribution */}
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Corruption Type Distribution
          </h3>
          {data.by_type.length > 0 ? (
            <>
              <div className="h-[200px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.by_type}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="total"
                    >
                      {data.by_type.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.by_type.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      ></div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {item.total}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm text-center py-10">
              No data available.
            </p>
          )}
        </div>
      </div>

      {/* Critical Hotspots Alert */}
      {data.critical_hotspots.length > 0 && (
        <div className="glass-card p-6 rounded-3xl border border-rose-500/20">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🚨</span>
            <div>
              <h3 className="text-sm font-black text-rose-500 uppercase tracking-wider">
                Critical Hotspots
              </h3>
              <p className="text-xs text-slate-500">
                Institutions with the most HIGH/CRITICAL priority cases
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.critical_hotspots.map((hotspot, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/20"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                  {hotspot.institution}
                </span>
                <span className="text-sm font-black text-rose-500 flex-shrink-0 ml-2">
                  {hotspot.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Province Bar Chart */}
      <div className="glass-card p-6 rounded-3xl">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          Province Comparison
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.by_province.filter((p) => p.total > 0)}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#64748b" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#64748b" }}
                width={130}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                {data.by_province
                  .filter((p) => p.total > 0)
                  .map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
