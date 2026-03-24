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
import { Language, t } from "../i18n";

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
  stage_history?: {
    stage: string;
    investigator_name: string;
    investigator_email: string;
    notes: string;
    final_score: number | null;
    performed_at: string;
  }[];
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

export const ReportGeneration: React.FC<{ language: Language }> = ({ language }) => {
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
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const officer = (window as any).__zacc_user_name || 'Authorized Officer';
    const total = cases.length;
    const avgRisk = total > 0 ? Math.round(cases.reduce((s, c) => s + (c.risk_score || 0), 0) / total) : 0;
    const categoryLabel = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Priority breakdown
    const critical = cases.filter(c => c.priority === 'CRITICAL').length;
    const high = cases.filter(c => c.priority === 'HIGH').length;
    const medium = cases.filter(c => c.priority === 'MEDIUM').length;
    const low = cases.filter(c => c.priority === 'LOW').length;

    // Type breakdown
    const typeMap: Record<string, number> = {};
    cases.forEach(c => { typeMap[c.type] = (typeMap[c.type] || 0) + 1; });

    // Status breakdown for in_progress
    const statusMap: Record<string, number> = {};
    cases.forEach(c => { statusMap[c.status] = (statusMap[c.status] || 0) + 1; });

    const priorityBarColor = (p: string) => {
      if (p === 'CRITICAL') return '#ef4444';
      if (p === 'HIGH') return '#f97316';
      if (p === 'MEDIUM') return '#eab308';
      return '#22c55e';
    };

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>ZACC Official Report — ${categoryLabel}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1e293b;background:#fff;font-size:11px;line-height:1.5;}
    .page{padding:40px 48px;max-width:1100px;margin:0 auto;}
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;color:rgba(16,185,129,0.04);font-weight:900;pointer-events:none;z-index:0;letter-spacing:8px;white-space:nowrap;}

    /* Cover header */
    .cover{border-bottom:3px solid #059669;padding-bottom:24px;margin-bottom:28px;}
    .cover-top{display:flex;justify-content:space-between;align-items:flex-start;}
    .logo-area{display:flex;align-items:center;gap:16px;}
    .logo-box{width:56px;height:56px;background:linear-gradient(135deg,#059669,#065f46);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;}
    .org-name{font-size:18px;font-weight:900;color:#065f46;text-transform:uppercase;letter-spacing:2px;}
    .org-sub{font-size:11px;color:#64748b;margin-top:2px;font-weight:600;}
    .cover-badge{text-align:right;}
    .confidential{font-size:9px;font-weight:900;color:#dc2626;letter-spacing:3px;text-transform:uppercase;background:#fef2f2;border:1px solid #fecaca;padding:4px 12px;border-radius:4px;}
    .cover-title{margin-top:20px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:0.5px;}
    .cover-meta{margin-top:8px;display:flex;gap:24px;flex-wrap:wrap;}
    .cover-meta span{font-size:10px;color:#64748b;font-weight:600;}
    .cover-meta strong{color:#334155;}

    /* Executive summary */
    .exec-summary{background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:24px;}
    .section-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#059669;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #d1fae5;}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;}
    .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;}
    .kpi-value{font-size:32px;font-weight:900;color:#065f46;}
    .kpi-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-top:4px;}
    .kpi-sub{font-size:9px;color:#94a3b8;margin-top:2px;}

    /* Charts via CSS */
    .chart-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;}
    .chart-box{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;}
    .chart-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#334155;margin-bottom:14px;}
    .bar-chart{display:flex;flex-direction:column;gap:8px;}
    .bar-row{display:flex;align-items:center;gap:10px;}
    .bar-label{font-size:10px;font-weight:700;color:#475569;width:80px;text-align:right;}
    .bar-track{flex:1;height:22px;background:#f1f5f9;border-radius:6px;overflow:hidden;position:relative;}
    .bar-fill{height:100%;border-radius:6px;display:flex;align-items:center;padding-left:8px;}
    .bar-count{font-size:9px;font-weight:800;color:#fff;}
    .type-list{display:flex;flex-direction:column;gap:6px;}
    .type-item{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #f1f5f9;}
    .type-name{font-size:10px;font-weight:700;color:#334155;display:flex;align-items:center;gap:8px;}
    .type-dot{width:8px;height:8px;border-radius:50%;}
    .type-count{font-size:12px;font-weight:900;color:#0f172a;}

    /* Table */
    .table-section{margin-top:28px;}
    .table-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
    .table-count{font-size:10px;font-weight:700;color:#64748b;}
    table{width:100%;border-collapse:collapse;font-size:10px;}
    thead th{background:#f8fafc;padding:10px 8px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:800;text-transform:uppercase;font-size:8px;letter-spacing:1px;color:#475569;}
    tbody td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;}
    tbody tr:nth-child(even){background:#fafbfc;}
    tbody tr:hover{background:#f0fdf4;}
    .ref-code{font-weight:800;color:#059669;font-size:10px;background:#f0fdf4;padding:2px 6px;border-radius:4px;border:1px solid #d1fae5;}
    .priority-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;}
    .priority-CRITICAL{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
    .priority-HIGH{background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;}
    .priority-MEDIUM{background:#fefce8;color:#ca8a04;border:1px solid #fef08a;}
    .priority-LOW{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;}
    .status-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:8px;font-weight:700;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;}
    .risk-bar{display:flex;align-items:center;gap:6px;}
    .risk-track{width:50px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;}
    .risk-fill{height:100%;border-radius:3px;}
    .risk-high{background:#ef4444;}
    .risk-med{background:#eab308;}
    .risk-low{background:#22c55e;}

    /* Audit trail within table */
    .audit-trail{margin-top:6px;}
    .audit-entry{background:#f8fafc;border-left:3px solid #059669;padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;}
    .audit-stage{font-weight:800;color:#065f46;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;}
    .audit-officer{font-size:9px;color:#475569;margin-top:2px;}
    .audit-time{font-size:8px;color:#94a3b8;margin-top:1px;}
    .audit-notes{font-size:9px;color:#64748b;font-style:italic;margin-top:3px;padding-top:3px;border-top:1px solid #e2e8f0;}
    .audit-score{font-size:8px;font-weight:700;color:#059669;margin-top:2px;}

    /* Case detail cards (for smaller sets) */
    .case-cards{display:flex;flex-direction:column;gap:16px;margin-top:16px;}
    .case-card{border:1px solid #e2e8f0;border-radius:12px;padding:20px;page-break-inside:avoid;}
    .case-card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;}
    .case-card-ref{font-size:14px;font-weight:900;color:#059669;}
    .case-card-meta{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;}
    .case-card-field .label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:2px;}
    .case-card-field .value{font-size:11px;font-weight:600;color:#1e293b;}
    .case-card-stages{margin-top:12px;}
    .case-card-stages-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#059669;margin-bottom:8px;}

    /* Footer */
    .report-footer{margin-top:40px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;}
    .footer-left{font-size:9px;color:#94a3b8;line-height:1.6;}
    .footer-right{text-align:right;font-size:8px;color:#cbd5e1;}

    @media print {
      body{padding:0;}
      .page{padding:24px 32px;}
      .watermark{font-size:60px;}
    }
  </style>
</head>
<body>
<div class="watermark">ZACC CONFIDENTIAL</div>
<div class="page">
  <!-- Cover Header -->
  <div class="cover">
    <div class="cover-top">
      <div class="logo-area">
        <div class="logo-box">Z</div>
        <div>
          <div class="org-name">Zimbabwe Anti-Corruption Commission</div>
          <div class="org-sub">Integrity Management System — Official Report</div>
        </div>
      </div>
      <div class="cover-badge">
        <div class="confidential">CONFIDENTIAL</div>
      </div>
    </div>
    <div class="cover-title">${categoryLabel} Cases Report</div>
    <div class="cover-meta">
      <span>Date: <strong>${dateStr}</strong></span>
      <span>Generated: <strong>${now}</strong></span>
      <span>Officer: <strong>${officer}</strong></span>
      <span>Total Cases: <strong>${total}</strong></span>
      ${dateFrom ? `<span>From: <strong>${dateFrom}</strong></span>` : ''}
      ${dateTo ? `<span>To: <strong>${dateTo}</strong></span>` : ''}
      ${typeFilter ? `<span>Type Filter: <strong>${typeFilter}</strong></span>` : ''}
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="exec-summary">
    <div class="section-title">Executive Summary</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-value">${total}</div>
        <div class="kpi-label">Total Cases</div>
        <div class="kpi-sub">In this report</div>
      </div>
      <div class="kpi">
        <div class="kpi-value" style="color:${avgRisk > 74 ? '#ef4444' : avgRisk > 40 ? '#eab308' : '#22c55e'}">${avgRisk}%</div>
        <div class="kpi-label">Avg Risk Score</div>
        <div class="kpi-sub">${avgRisk > 74 ? 'High risk portfolio' : avgRisk > 40 ? 'Moderate risk' : 'Low risk portfolio'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-value" style="color:#ef4444">${critical + high}</div>
        <div class="kpi-label">High/Critical Priority</div>
        <div class="kpi-sub">${total > 0 ? Math.round(((critical + high) / total) * 100) : 0}% of total</div>
      </div>
      <div class="kpi">
        <div class="kpi-value" style="color:#059669">${Object.keys(typeMap).length}</div>
        <div class="kpi-label">Corruption Types</div>
        <div class="kpi-sub">Distinct categories</div>
      </div>
    </div>
  </div>

  <!-- Analysis Charts -->
  <div class="chart-row">
    <div class="chart-box">
      <div class="chart-title">Priority Distribution</div>
      <div class="bar-chart">
        ${[
          { label: 'Critical', count: critical, color: '#ef4444' },
          { label: 'High', count: high, color: '#f97316' },
          { label: 'Medium', count: medium, color: '#eab308' },
          { label: 'Low', count: low, color: '#22c55e' },
        ].map(p => `
          <div class="bar-row">
            <div class="bar-label">${p.label}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${total > 0 ? Math.max((p.count / total) * 100, p.count > 0 ? 8 : 0) : 0}%;background:${p.color}">
                ${p.count > 0 ? `<span class="bar-count">${p.count}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="chart-box">
      <div class="chart-title">By Corruption Type</div>
      <div class="type-list">
        ${Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([name, count], i) => {
          const colors = ['#10b981','#6366f1','#f59e0b','#f43f5e','#a855f7','#06b6d4'];
          return `<div class="type-item">
            <div class="type-name"><span class="type-dot" style="background:${colors[i % colors.length]}"></span>${name}</div>
            <div class="type-count">${count}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>

  ${category === 'in_progress' ? `
  <div class="chart-row">
    <div class="chart-box" style="grid-column:span 2">
      <div class="chart-title">Status Distribution — Active Pipeline</div>
      <div class="bar-chart">
        ${['SUBMITTED','UNDER_REVIEW','INVESTIGATING','REFERRED'].map(s => {
          const cnt = statusMap[s] || 0;
          const colors: Record<string, string> = { SUBMITTED:'#3b82f6', UNDER_REVIEW:'#6366f1', INVESTIGATING:'#f59e0b', REFERRED:'#a855f7' };
          return `<div class="bar-row">
            <div class="bar-label">${s.replace('_',' ')}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${total > 0 ? Math.max((cnt / total) * 100, cnt > 0 ? 8 : 0) : 0}%;background:${colors[s] || '#94a3b8'}">
                ${cnt > 0 ? `<span class="bar-count">${cnt}</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>` : ''}

  <!-- Detailed Case Listing -->
  <div class="table-section">
    <div class="table-header">
      <div class="section-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0">Detailed Case Register</div>
      <div class="table-count">${total} case${total === 1 ? '' : 's'} listed</div>
    </div>

    ${total <= 20 ? `
    <!-- Card view for manageable number of cases -->
    <div class="case-cards">
      ${cases.map((c, i) => `
      <div class="case-card">
        <div class="case-card-header">
          <div>
            <span class="ref-code">${c.reference_code || c.case_id}</span>
            <span style="font-size:9px;color:#94a3b8;margin-left:8px;">#${i + 1}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="priority-badge priority-${c.priority}">${c.priority}</span>
            <span class="status-badge">${c.status.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="case-card-meta">
          <div class="case-card-field"><div class="label">Corruption Type</div><div class="value">${c.type}</div></div>
          <div class="case-card-field"><div class="label">Institution</div><div class="value">${c.institution || 'Not specified'}</div></div>
          <div class="case-card-field"><div class="label">Location</div><div class="value">${c.location || 'Not specified'}</div></div>
          <div class="case-card-field">
            <div class="label">Risk Score</div>
            <div class="value">
              <div class="risk-bar">
                <div class="risk-track"><div class="risk-fill ${c.risk_score > 74 ? 'risk-high' : c.risk_score > 40 ? 'risk-med' : 'risk-low'}" style="width:${c.risk_score}%"></div></div>
                <span>${c.risk_score}%</span>
              </div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:10px;">
          <div><span style="color:#94a3b8;font-weight:700;">Filed:</span> ${c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
          <div><span style="color:#94a3b8;font-weight:700;">Last Updated:</span> ${c.last_updated ? new Date(c.last_updated).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
        </div>
        ${c.dispute_reason ? `<div style="margin-top:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;"><span style="font-size:9px;font-weight:800;color:#dc2626;text-transform:uppercase;">Dispute Statement:</span><p style="font-size:10px;color:#7f1d1d;margin-top:4px;">${c.dispute_reason}</p></div>` : ''}
        ${c.stage_history && c.stage_history.length > 0 ? `
        <div class="case-card-stages">
          <div class="case-card-stages-title">Investigation Audit Trail</div>
          <div class="audit-trail">
            ${c.stage_history.map((s: any) => `
            <div class="audit-entry">
              <div class="audit-stage">${s.stage.replace(/_/g, ' ')}</div>
              <div class="audit-officer">${s.investigator_name}${s.investigator_email ? ' (' + s.investigator_email + ')' : ''}</div>
              <div class="audit-time">${s.performed_at ? new Date(s.performed_at).toLocaleString() : '—'}</div>
              ${s.final_score != null ? `<div class="audit-score">Assessment Score: ${s.final_score}/100</div>` : ''}
              ${s.notes ? `<div class="audit-notes">${s.notes}</div>` : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`).join('')}
    </div>
    ` : `
    <!-- Table view for large datasets -->
    <table>
      <thead><tr>
        <th>#</th><th>Reference</th><th>Type</th><th>Institution</th><th>Location</th><th>Priority</th><th>Status</th><th>Risk</th><th>Filed</th><th>Audit Trail</th>
      </tr></thead>
      <tbody>
        ${cases.map((c, i) => `
        <tr>
          <td style="font-weight:700;color:#94a3b8;">${i + 1}</td>
          <td><span class="ref-code">${c.reference_code || c.case_id}</span></td>
          <td style="font-weight:600;">${c.type}</td>
          <td>${c.institution || '—'}</td>
          <td>${c.location || '—'}</td>
          <td><span class="priority-badge priority-${c.priority}">${c.priority}</span></td>
          <td><span class="status-badge">${c.status.replace(/_/g, ' ')}</span></td>
          <td>
            <div class="risk-bar">
              <div class="risk-track"><div class="risk-fill ${c.risk_score > 74 ? 'risk-high' : c.risk_score > 40 ? 'risk-med' : 'risk-low'}" style="width:${c.risk_score}%"></div></div>
              <span style="font-weight:700;font-size:9px;">${c.risk_score}%</span>
            </div>
          </td>
          <td style="white-space:nowrap;">${c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</td>
          <td>${c.stage_history && c.stage_history.length > 0
            ? `<div class="audit-trail">${c.stage_history.map((s: any) =>
                `<div class="audit-entry">
                  <div class="audit-stage">${s.stage.replace(/_/g,' ')}</div>
                  <div class="audit-officer">${s.investigator_name}${s.investigator_email ? ' (' + s.investigator_email + ')' : ''}</div>
                  <div class="audit-time">${s.performed_at ? new Date(s.performed_at).toLocaleString() : '—'}${s.final_score != null ? ' · Score: ' + s.final_score + '/100' : ''}</div>
                  ${s.notes ? `<div class="audit-notes">${s.notes}</div>` : ''}
                </div>`).join('')}</div>`
            : '<span style="color:#cbd5e1;font-size:9px;">No actions recorded</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    `}
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <div class="footer-left">
      <strong>Zimbabwe Anti-Corruption Commission</strong><br/>
      Integrity Management System — Official Document<br/>
      This report is confidential and intended for authorized personnel only.
    </div>
    <div class="footer-right">
      Report ID: ZACC-RPT-${Date.now().toString(36).toUpperCase()}<br/>
      Generated: ${now}<br/>
      Page 1 of 1
    </div>
  </div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),600);</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
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
      label: t(language, "overview"),
      count: data?.overview?.total,
      color: "text-white",
    },
    {
      id: "successful",
      label: t(language, "successful"),
      count: data?.overview?.successful,
      color: "text-emerald-500",
    },
    {
      id: "in_progress",
      label: t(language, "inProgress"),
      count: data?.overview?.in_progress,
      color: "text-amber-500",
    },
    {
      id: "closed",
      label: t(language, "closed"),
      count: data?.overview?.closed,
      color: "text-blue-500",
    },
    {
      id: "disputed",
      label: t(language, "disputed"),
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
            {t(language, "generatingReports")}
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
              {t(language, "from")}
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
              {t(language, "to")}
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
              {t(language, "type")}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white"
            >
              <option value="">{t(language, "allTypes")}</option>
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
            {t(language, "applyFilters")}
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
                label: t(language, "totalCases"),
                value: data.overview.total,
                icon: "📊",
                color: "text-slate-900 dark:text-white",
              },
              {
                label: t(language, "successful"),
                value: data.overview.successful,
                icon: "✅",
                color: "text-emerald-500",
              },
              {
                label: t(language, "inProgress"),
                value: data.overview.in_progress,
                icon: "⏳",
                color: "text-amber-500",
              },
              {
                label: t(language, "disputed"),
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
                {t(language, "resolutionRate")}
              </p>
              <p className="text-3xl font-black text-emerald-500">
                {data.overview.resolution_rate}%
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-blue-500/20">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t(language, "successRate")}
              </p>
              <p className="text-3xl font-black text-blue-500">
                {data.overview.success_rate}%
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-amber-500/20">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t(language, "avgRiskScore")}
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
                {t(language, "monthlyTrend")}
              </h3>
              <div className="h-[240px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={260}
                  minHeight={220}
                >
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
                {t(language, "byType")}
              </h3>
              {typeData.length > 0 ? (
                <>
                  <div className="h-[160px] mb-3">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={220}
                      minHeight={140}
                    >
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
                  {t(language, "noDataAvailable")}
                </p>
              )}
            </div>
          </div>

          {/* Priority Breakdown Bar Chart */}
          {priorityData.length > 0 && (
            <div className="glass-card p-6 rounded-3xl">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                {t(language, "byPriority")}
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={260}
                  minHeight={180}
                >
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
                ? t(language, "successful")
                : activeTab === "in_progress"
                  ? t(language, "inProgress")
                  : activeTab === "closed"
                    ? t(language, "closed")
                    : t(language, "disputed")}{" "}
              {t(language, "cases")}
            </h3>
            <button
              onClick={() => generatePDF(activeTab, getCasesForTab(activeTab))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
            >
              📄 {t(language, "exportPdf")}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] overflow-hidden">
            {getCasesForTab(activeTab).length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 font-medium">
                  {t(language, "noCasesInCategory")}
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
