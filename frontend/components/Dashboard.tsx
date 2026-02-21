
import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { apiClient } from '../services/api';
import { CaseReport, CaseStatus } from '../types';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#f43f5e', '#a855f7'];

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
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const stats = [
    { label: 'Total Reports', value: cases.length, icon: '📄', color: 'emerald' },
    { label: 'Active Pipeline', value: cases.filter(c => c.status !== CaseStatus.CLOSED).length, icon: '⚡', color: 'indigo' },
    { label: 'Integrity Alerts', value: cases.filter(c => c.status === CaseStatus.DISPUTED).length, icon: '🚨', color: 'rose' },
    { label: 'Finalized Dossiers', value: cases.filter(c => c.status === CaseStatus.CLOSED).length, icon: '✅', color: 'emerald' },
  ];

  const distributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach(c => {
      counts[c.type] = (counts[c.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [cases]);

  const trendData = [
    { name: 'Week 1', value: 12 },
    { name: 'Week 2', value: 18 },
    { name: 'Week 3', value: 15 },
    { name: 'Week 4', value: cases.length },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className={`glass-card p-6 rounded-3xl hover:translate-y-[-2px] transition-all duration-300 border-l-4 ${
            stat.label === 'Integrity Alerts' && stat.value > 0 ? 'border-l-rose-500' : 'border-l-transparent'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audit Metric</span>
            </div>
            <p className={`text-3xl font-bold mb-1 ${stat.label === 'Integrity Alerts' && stat.value > 0 ? 'text-rose-400' : 'text-white'}`}>
              {stat.value}
            </p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-card p-8 rounded-4xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white">Engagement Activity</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-nexus-emerald/10 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-nexus-emerald"></div>
                <span className="text-[10px] font-bold text-nexus-emerald uppercase">Live Intelligence</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} dy={10} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 glass-card p-8 rounded-4xl">
          <h3 className="text-lg font-bold text-white mb-8">Sector Spread</h3>
          <div className="h-[240px]">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                    {distributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm font-medium text-center">
                <div className="text-3xl mb-3">📡</div>
                Scanning for categorical data...
              </div>
            )}
          </div>
          <div className="mt-6 space-y-2">
            {distributionData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></div>
                  <span className="text-slate-400">{item.name}</span>
                </div>
                <span className="text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`p-10 rounded-5xl bg-gradient-to-br border flex flex-col md:flex-row items-center gap-10 ${
        cases.some(c => c.status === CaseStatus.DISPUTED) 
          ? 'from-rose-500/10 to-transparent border-rose-500/20' 
          : 'from-nexus-emerald/10 to-transparent border-nexus-emerald/20'
      }`}>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white mb-4">
            {cases.some(c => c.status === CaseStatus.DISPUTED) ? 'Integrity Dispute Alert' : 'Empowering Integrity'}
          </h3>
          <p className="text-slate-400 leading-relaxed font-medium">
            {cases.some(c => c.status === CaseStatus.DISPUTED) 
              ? 'Whistleblowers have re-triggered cases due to unsatisfactory resolution. ZACC is prioritizing high-standard audits for these dossiers to ensure no corruption goes unpunished.'
              : 'ZACC is committed to absolute transparency and protection. Every report counts towards a more equitable and corruption-free Zimbabwe.'}
          </p>
        </div>
        <button className={`${
          cases.some(c => c.status === CaseStatus.DISPUTED) 
            ? 'bg-rose-500 hover:bg-rose-600' 
            : 'bg-nexus-emerald hover:bg-emerald-400'
          } text-nexus-950 px-8 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105 soft-glow shadow-xl`}>
          {cases.some(c => c.status === CaseStatus.DISPUTED) ? 'Audit Disputed Cases' : 'Speak Out Now'}
        </button>
      </div>
    </div>
  );
};
