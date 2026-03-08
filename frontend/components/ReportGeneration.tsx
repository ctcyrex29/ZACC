import React, { useState, useEffect } from "react";
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
  BarChart,
  Bar,
} from "recharts";
import { apiClient } from "../services/api";

const COLORS = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
];

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    UNDER_REVIEW: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    INVESTIGATING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    REFERRED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    CLOSED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    DISPUTED: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  return map[s] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
};

const priorityColor = (p: string) => {
  if (p === "CRITICAL") return "text-rose-500";
  if (p === "HIGH") return "text-orange-500";
  if (p === "MEDIUM") return "text-amber-500";
  return "text-emerald-500";
};

type Tab = "overview" | "successful" | "in_progress" | "closed" | "disputed";

interface ReportCase {
  case_id: string;
  reference_code: string;
  type: string;
  institution: string;
  location: string;
  status: string;
  priority: string;
  risk_score: number;
  created_at: string;
  last_updated: string;
  dispute_reason?: string;
}

interface SummaryData {
  overview: {
    total: number;
    successful: number;
    in_progress: number;
    closed: number;
    disputed: number;
    avg_risk_score: number;
    resolution_rate: number;
    success_rate: number;
  };
  by_priority: Record<string, number>;
  by_type: Record<string, number>;
  monthly_trend: {
    month: string;
    total: number;
    successful: number;
    in_progress: number;
    closed: number;
    disputed: number;
  }[];
  successful_cases: ReportCase[];
  in_progress_cases: ReportCase[];
  closed_cases: ReportCase[];
  disputed_cases: ReportCase[];
}

export const ReportGeneration: React.FC = () => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;
      if (typeFilter) filters.type = typeFilter;

      const response = await apiClient.getReportSummary(filters);
      if (response?.success) {
        setData(response.data);
      }
    } catch (err) {
      console.error("Report generation fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generatePDF = (category: string, cases: ReportCase[]) => {
    const now = new Date().toLocaleString();
    const html = `
      <html>
      <head><title>ZACC Report - ${category}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
        h1 { color: #065f46; border-bottom: 3px solid #10b981; padding-bottom: 10px; }
        h2 { color: #334155; margin-top: 30px; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th { background: #f1f5f9; padding: 10px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) { background: #f8fafc; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: 800; color: #065f46; }
        .stat-label { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; margin-top: 4px; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 80px; color: rgba(16,185,129,0.06); font-weight: 900; pointer-events: none; z-index: 0; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head>
      <body>
        <div class="watermark">ZACC CONFIDENTIAL</div>
        <h1>Zimbabwe Anti-Corruption Commission</h1>
        <h2>Case Report: ${category.charAt(0).toUpperCase() + category.slice(1)} Cases</h2>
        <p class="meta">Generated: ${now} | Total Cases: ${cases.length}</p>
        ${
          data?.overview
            ? `
        <div class="stats">
          <div class="stat-card"><div class="stat-value">${data.overview.total}</div><div class="stat-label">Total Cases</div></div>
          <div class="stat-card"><div class="stat-value">${data.overview.successful}</div><div class="stat-label">Successful</div></div>
          <div class="stat-card"><div class="stat-value">${data.overview.in_progress}</div><div class="stat-label">In Progress</div></div>
          <div class="stat-card"><div class="stat-value">${data.overview.disputed}</div><div class="stat-label">Disputed</div></div>
        </div>
        `
            : ""
        }
        <table>
          <thead><tr>
            <th>#</th><th>Reference</th><th>Type</th><th>Institution</th><th>Location</th><th>Priority</th><th>Status</th><th>Risk</th><th>Date</th>
          </tr></thead>
          <tbody>
            ${cases
              .map(
                (c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${c.reference_code || c.case_id}</strong></td>
                <td>${c.type}</td>
                <td>${c.institution || "-"}</td>
                <td>${c.location || "-"}</td>
                <td>${c.priority}</td>
                <td>${c.status}</td>
                <td>${c.risk_score}%</td>
                <td>${c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">
          <p>ZACC Anti-Corruption Case Management System — Official Document</p>
          <p>This report is confidential and intended for authorized personnel only.</p>
        </div>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  const tabs: {
    id: Tab;
    label: string;
    count: number | undefined;
    color: string;
  }[] = [
    {
      id: "overview",
      label: "Overview",
      count: data?.overview?.total,
      color: "text-white",
    },
    {
      id: "successful",
      label: "Successful",
      count: data?.overview?.successful,
      color: "text-emerald-500",
    },
    {
      id: "in_progress",
      label: "In Progress",
      count: data?.overview?.in_progress,
      color: "text-amber-500",
    },
    {
      id: "closed",
      label: "Closed",
      count: data?.overview?.closed,
      color: "text-blue-500",
    },
    {
      id: "disputed",
      label: "Disputed",
      count: data?.overview?.disputed,
      color: "text-rose-500",
    },
  ];

  const getCasesForTab = (tab: Tab): ReportCase[] => {
    if (!data) return [];
    switch (tab) {
      case "successful":
        return data.successful_cases;
      case "in_progress":
        return data.in_progress_cases;
      case "closed":
        return data.closed_cases;
      case "disputed":
        return data.disputed_cases;
      default:
        return [];
    }
  };

  const priorityData = data
    ? Object.entries(data.by_priority).map(([name, value]) => ({ name, value }))
    : [];
  const typeData = data
    ? Object.entries(data.by_type).map(([name, value]) => ({ name, value }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 font-semibold">
            Generating reports...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="Bribery">Bribery</option>
              <option value="Procurement Fraud">Procurement Fraud</option>
              <option value="Abuse of Office">Abuse of Office</option>
              <option value="Embezzlement">Embezzlement</option>
              <option value="Nepotism">Nepotism</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button
            onClick={fetchData}
            className="px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? "bg-white dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white shadow-sm"
                : "bg-transparent border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black ${tab.color}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total Cases",
                value: data.overview.total,
                icon: "📊",
                color: "text-slate-900 dark:text-white",
              },
              {
                label: "Successful",
                value: data.overview.successful,
                icon: "✅",
                color: "text-emerald-500",
              },
              {
                label: "In Progress",
                value: data.overview.in_progress,
                icon: "⏳",
                color: "text-amber-500",
              },
              {
                label: "Disputed",
                value: data.overview.disputed,
                icon: "🚨",
                color: "text-rose-500",
              },
            ].map((s, i) => (
              <div key={i} className="glass-card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl">{s.icon}</span>
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-emerald-500/20">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Resolution Rate
              </p>
              <p className="text-3xl font-black text-emerald-500">
                {data.overview.resolution_rate}%
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-blue-500/20">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Success Rate
              </p>
              <p className="text-3xl font-black text-blue-500">
                {data.overview.success_rate}%
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-amber-500/20">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Avg Risk Score
              </p>
              <p className="text-3xl font-black text-amber-500">
                {data.overview.avg_risk_score}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <div className="glass-card p-6 rounded-3xl">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                Monthly Trend
              </h3>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.monthly_trend}>
                    <defs>
                      <linearGradient
                        id="colorSuccess"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="successful"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSuccess)"
                    />
                    <Area
                      type="monotone"
                      dataKey="disputed"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fill="none"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Type Distribution */}
            <div className="glass-card p-6 rounded-3xl">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                By Type
              </h3>
              {typeData.length > 0 ? (
                <>
                  <div className="h-[160px] mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {typeData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {typeData.map((item, i) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: COLORS[i % COLORS.length] }}
                          ></div>
                          <span className="text-xs text-slate-400 truncate max-w-[140px]">
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
                  No data available.
                </p>
              )}
            </div>
          </div>

          {/* Priority Breakdown Bar Chart */}
          {priorityData.length > 0 && (
            <div className="glass-card p-6 rounded-3xl">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                By Priority
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {priorityData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.name === "CRITICAL"
                              ? "#f43f5e"
                              : entry.name === "HIGH"
                                ? "#f97316"
                                : entry.name === "MEDIUM"
                                  ? "#f59e0b"
                                  : "#10b981"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* Case Tables for non-overview tabs */}
      {activeTab !== "overview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {activeTab === "successful"
                ? "Successful"
                : activeTab === "in_progress"
                  ? "In Progress"
                  : activeTab === "closed"
                    ? "Closed"
                    : "Disputed"}{" "}
              Cases
            </h3>
            <button
              onClick={() => generatePDF(activeTab, getCasesForTab(activeTab))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
            >
              📄 Export PDF
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] overflow-hidden">
            {getCasesForTab(activeTab).length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 font-medium">
                  No cases in this category.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      {[
                        "#",
                        "Reference",
                        "Type",
                        "Institution",
                        "Location",
                        "Priority",
                        "Status",
                        "Risk",
                        "Date",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {getCasesForTab(activeTab).map((c, idx) => (
                      <tr
                        key={c.case_id}
                        className="hover:bg-slate-50 dark:hover:bg-white/3 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-slate-500 font-bold">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                            {c.reference_code || c.case_id}
                          </code>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {c.type}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
                          {c.institution || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                          {c.location || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-black uppercase ${priorityColor(c.priority)}`}
                          >
                            {c.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge(c.status)}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${c.risk_score > 74 ? "bg-rose-500" : c.risk_score > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${c.risk_score}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {c.risk_score}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
