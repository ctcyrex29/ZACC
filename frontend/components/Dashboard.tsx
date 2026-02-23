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

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await apiClient.getReports();
        if (response && response.success && Array.isArray(response.data)) {
          const mappedCases = response.data.map((report: any) => ({
            id: report.case_id,
            timestamp: report.created_at,
            type: report.type,
            status: report.status,
            riskScore: report.risk_score,
            priority: report.priority,
            institution: report.institution,
            description: report.description,
          }));
          setCases(mappedCases);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const stats = [
    {
      label: "Total Reports",
      value: cases.length,
      icon: "📄",
      color: "emerald",
    },
    {
      label: "Active Pipeline",
      value: cases.filter((c) => c.status !== CaseStatus.CLOSED).length,
      icon: "⚡",
      color: "indigo",
    },
    {
      label: "Integrity Alerts",
      value: cases.filter((c) => c.status === CaseStatus.DISPUTED).length,
      icon: "🚨",
      color: "rose",
    },
    {
      label: "Finalized Dossiers",
      value: cases.filter((c) => c.status === CaseStatus.CLOSED).length,
      icon: "✅",
      color: "emerald",
    },
  ];

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
    { name: "Week 4", value: cases.length },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`glass-card p-6 rounded-3xl hover:translate-y-[-2px] transition-all duration-300 border-l-4 ${
              stat.label === "Integrity Alerts" && stat.value > 0
                ? "border-l-rose-500"
                : "border-l-transparent"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Audit Metric
              </span>
            </div>
            <p
              className={`text-3xl font-bold mb-1 ${stat.label === "Integrity Alerts" && stat.value > 0 ? "text-rose-400" : "text-white"}`}
            >
              {stat.value}
            </p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-card p-8 rounded-4xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white">
              Engagement Activity
            </h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-nexus-emerald/10 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-nexus-emerald"></div>
                <span className="text-[10px] font-bold text-nexus-emerald uppercase">
                  Live Intelligence
                </span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
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
      </div>
    </div>
  );
};
