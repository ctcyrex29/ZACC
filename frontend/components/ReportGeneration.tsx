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
    SUCCESSFUL: "bg-teal-500/10 text-teal-500 border-teal-500/20",
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
  evidence_count?: number;
  evidence_types?: Record<string, number>;
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
    const reportId = 'ZACC/RPT/' + new Date().getFullYear() + '/' + Date.now().toString(36).toUpperCase();

    // Priority breakdown
    const critical = cases.filter(c => c.priority === 'CRITICAL').length;
    const high = cases.filter(c => c.priority === 'HIGH').length;
    const medium = cases.filter(c => c.priority === 'MEDIUM').length;
    const low = cases.filter(c => c.priority === 'LOW').length;

    // Type breakdown
    const typeMap: Record<string, number> = {};
    cases.forEach(c => { typeMap[c.type] = (typeMap[c.type] || 0) + 1; });

    // Status breakdown
    const statusMap: Record<string, number> = {};
    cases.forEach(c => { statusMap[c.status] = (statusMap[c.status] || 0) + 1; });

    // Location breakdown
    const locationMap: Record<string, number> = {};
    cases.forEach(c => { const loc = c.location || 'Unspecified'; locationMap[loc] = (locationMap[loc] || 0) + 1; });

    // Institution breakdown
    const instMap: Record<string, number> = {};
    cases.forEach(c => { const inst = c.institution || 'Unspecified'; instMap[inst] = (instMap[inst] || 0) + 1; });

    const pdfStatusLabel = (s: string) => {
      const map: Record<string, string> = {
        SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', INVESTIGATING: 'Under Investigation',
        REFERRED: 'Referred to Other Authorities', SUCCESSFUL: '✓ Successfully Resolved', CLOSED: 'Closed', DISPUTED: 'Under Dispute'
      };
      return map[s] || s;
    };

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
  <title>ZACC Official Filing - ${categoryLabel} Cases - ${reportId}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm 25mm 18mm; }
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Times New Roman',Georgia,'Segoe UI',serif;color:#1a1a1a;background:#fff;font-size:11pt;line-height:1.6;}
    .page{max-width:760px;margin:0 auto;padding:30px 40px;}
    .official-header{text-align:center;padding-bottom:18px;border-bottom:3px double #1a472a;margin-bottom:20px;}
    .coat-of-arms{width:72px;height:72px;margin:0 auto 10px;border-radius:50%;overflow:hidden;border:3px solid #b5985a;}
    .coat-of-arms img{width:100%;height:100%;object-fit:cover;}
    .state-name{font-size:9pt;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#666;margin-bottom:2px;}
    .commission-name{font-size:15pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#1a472a;margin-bottom:2px;}
    .commission-sub{font-size:9pt;color:#555;font-style:italic;margin-bottom:8px;}
    .motto{font-size:8pt;color:#888;font-style:italic;letter-spacing:1px;}
    .doc-meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding:12px 16px;background:#f9f7f2;border:1px solid #e5e0d5;border-radius:4px;}
    .doc-meta-left{text-align:left;} .doc-meta-right{text-align:right;}
    .doc-meta .label{font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;}
    .doc-meta .value{font-size:10pt;font-weight:bold;color:#1a1a1a;}
    .doc-meta .ref-num{font-size:11pt;font-weight:bold;color:#1a472a;font-family:'Courier New',monospace;}
    .classification{display:inline-block;font-size:8pt;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#b91c1c;border:2px solid #b91c1c;padding:2px 10px;border-radius:2px;margin-top:4px;}
    .doc-title{text-align:center;margin:20px 0;padding:16px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc;}
    .doc-title h1{font-size:16pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a;margin-bottom:4px;}
    .doc-title .subtitle{font-size:10pt;color:#555;}
    .section{margin-bottom:22px;}
    .section-num{font-size:11pt;font-weight:bold;color:#1a472a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;}
    .section-body{font-size:10.5pt;color:#333;text-align:justify;}
    .section-body p{margin-bottom:8px;}
    .summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;}
    .summary-item{padding:12px;border:1px solid #ddd;border-radius:4px;background:#fafaf7;}
    .summary-item .s-label{font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:bold;display:block;margin-bottom:2px;}
    .summary-item .s-value{font-size:18pt;font-weight:bold;color:#1a472a;}
    .summary-item .s-note{font-size:8pt;color:#999;margin-top:2px;}
    .priority-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt;}
    .priority-table th{background:#1a472a;color:#fff;padding:8px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;}
    .priority-table td{padding:8px 12px;border-bottom:1px solid #e5e5e5;}
    .priority-table tr:nth-child(even) td{background:#fafaf7;}
    .p-indicator{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle;}
    .p-critical{background:#dc2626;} .p-high{background:#ea580c;} .p-medium{background:#ca8a04;} .p-low{background:#16a34a;}
    .breakdown-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.5pt;}
    .breakdown-table th{text-align:left;padding:6px 10px;background:#f2f0eb;font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #ddd;}
    .breakdown-table td{padding:6px 10px;border-bottom:1px solid #eee;}
    .breakdown-table td:last-child{text-align:right;font-weight:bold;}
    .pct-bar{display:inline-block;height:12px;background:#1a472a;border-radius:2px;margin-right:6px;vertical-align:middle;}
    .case-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:9.5pt;}
    .case-table th{background:#1a472a;color:#fff;padding:8px 10px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;}
    .case-table td{padding:8px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top;}
    .case-table tr:nth-child(even) td{background:#fafaf7;}
    .case-ref{font-weight:bold;color:#1a472a;font-family:'Courier New',monospace;font-size:9pt;}
    .case-priority{display:inline-block;padding:1px 8px;border-radius:2px;font-size:8pt;font-weight:bold;text-transform:uppercase;}
    .cp-CRITICAL{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
    .cp-HIGH{background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;}
    .cp-MEDIUM{background:#fefce8;color:#ca8a04;border:1px solid #fef08a;}
    .cp-LOW{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;}
    .dossier{page-break-inside:avoid;border:1px solid #ddd;border-radius:4px;padding:16px;margin:14px 0;background:#fff;}
    .dossier-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:1px solid #eee;margin-bottom:10px;}
    .dossier-ref{font-size:12pt;font-weight:bold;color:#1a472a;font-family:'Courier New',monospace;}
    .dossier-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;}
    .dossier-field .df-label{font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:bold;display:block;}
    .dossier-field .df-value{font-size:10pt;color:#1a1a1a;font-weight:600;}
    .audit-section{margin-top:10px;padding-top:8px;border-top:1px solid #eee;}
    .audit-title{font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#1a472a;margin-bottom:6px;}
    .audit-entry{border-left:3px solid #1a472a;padding:6px 10px;margin-bottom:6px;background:#f9f7f2;border-radius:0 4px 4px 0;}
    .a-stage{font-weight:bold;color:#1a472a;text-transform:uppercase;font-size:9pt;}
    .a-officer{font-size:9pt;color:#555;margin-top:1px;}
    .a-time{font-size:8pt;color:#999;} .a-score{font-size:8pt;font-weight:bold;color:#1a472a;margin-top:1px;}
    .a-notes{font-size:9pt;color:#666;font-style:italic;margin-top:3px;padding-top:3px;border-top:1px solid #e5e5e5;}
    .risk-bar{display:flex;align-items:center;gap:6px;}
    .risk-track{width:50px;height:6px;background:#e5e5e5;border-radius:3px;overflow:hidden;}
    .risk-fill{height:100%;border-radius:3px;}
    .risk-high{background:#dc2626;} .risk-med{background:#ca8a04;} .risk-low{background:#16a34a;}
    .dispute-box{margin-top:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:10px;}
    .dispute-label{font-size:8pt;font-weight:bold;color:#b91c1c;text-transform:uppercase;letter-spacing:1px;}
    .dispute-text{font-size:9.5pt;color:#7f1d1d;margin-top:4px;font-style:italic;}
    .signature-block{margin-top:40px;padding-top:20px;border-top:2px solid #1a472a;}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:20px;}
    .sig-item{text-align:center;}
    .sig-line{border-top:1px solid #333;margin-top:50px;padding-top:6px;}
    .sig-name{font-weight:bold;font-size:10pt;} .sig-title{font-size:9pt;color:#555;} .sig-date{font-size:8pt;color:#999;margin-top:2px;}
    .doc-footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:8pt;color:#999;}
    @media print { body{padding:0;} .page{padding:0;} .dossier{break-inside:avoid;} }
  </style>
</head>
<body>
<div class="page">
  <div class="official-header">
    <div class="coat-of-arms"><img src="${window.location.origin}/zacc-logo.png" alt="ZACC"/></div>
    <div class="state-name">Republic of Zimbabwe</div>
    <div class="commission-name">Zimbabwe Anti-Corruption Commission</div>
    <div class="commission-sub">Established under Section 254 of the Constitution of Zimbabwe</div>
    <div class="motto">"Fighting Corruption, Promoting Integrity"</div>
  </div>

  <div class="doc-meta">
    <div class="doc-meta-left">
      <span class="label">Document Reference</span>
      <span class="ref-num">${reportId}</span>
      <br/><span class="classification">CONFIDENTIAL</span>
    </div>
    <div class="doc-meta-right">
      <span class="label">Date of Issue</span>
      <span class="value">${dateStr}</span><br/>
      <span class="label" style="margin-top:6px;">Prepared By</span>
      <span class="value">${officer}</span>
    </div>
  </div>

  <div class="doc-title">
    <h1>${categoryLabel} Cases &mdash; Comprehensive Report</h1>
    <div class="subtitle">Period: ${dateFrom || 'Inception'} to ${dateTo || dateStr}${typeFilter ? ' | Corruption Type: ' + typeFilter : ''}</div>
  </div>

  <div class="section">
    <div class="section-num">1. Purpose &amp; Scope</div>
    <div class="section-body">
      <p>This report is compiled by the Zimbabwe Anti-Corruption Commission (ZACC)
      pursuant to the Commission's mandate under the Anti-Corruption Commission Act
      [Chapter 9:22]. It presents a detailed account of <strong>${total} case${total !== 1 ? 's' : ''}</strong>
      classified under the <strong>&ldquo;${categoryLabel}&rdquo;</strong> category as at <strong>${dateStr}</strong>.</p>
      <p>The report is intended for internal use by authorised ZACC personnel, partner agencies,
      and where applicable, the National Prosecuting Authority (NPA) and the Zimbabwe Republic
      Police (ZRP) for referral and prosecution purposes.</p>
    </div>
  </div>

  <div class="section">
    <div class="section-num">2. Executive Summary</div>
    <div class="section-body">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="s-label">Total Cases in Report</span>
          <span class="s-value">${total}</span>
        </div>
        <div class="summary-item">
          <span class="s-label">Average Risk Assessment</span>
          <span class="s-value" style="color:${avgRisk > 74 ? '#dc2626' : avgRisk > 40 ? '#ca8a04' : '#16a34a'}">${avgRisk}%</span>
          <span class="s-note">${avgRisk > 74 ? 'High-risk portfolio' : avgRisk > 40 ? 'Moderate risk level' : 'Low risk level'}</span>
        </div>
        <div class="summary-item">
          <span class="s-label">Critical / High Priority Cases</span>
          <span class="s-value" style="color:#dc2626">${critical + high}</span>
          <span class="s-note">${total > 0 ? Math.round(((critical + high) / total) * 100) : 0}% of total case load</span>
        </div>
        <div class="summary-item">
          <span class="s-label">Distinct Corruption Categories</span>
          <span class="s-value">${Object.keys(typeMap).length}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-num">3. Priority Classification Matrix</div>
    <div class="section-body">
      <p>Cases are assigned priority levels through ZACC's multi-factor assessment framework,
      which considers the nature and severity of the alleged corruption, institutional impact,
      monetary values involved, and evidence strength.</p>
      <table class="priority-table">
        <thead><tr><th>Priority Level</th><th>No. of Cases</th><th>Proportion</th><th>Assessment</th></tr></thead>
        <tbody>
          <tr><td><span class="p-indicator p-critical"></span>Critical</td><td><strong>${critical}</strong></td><td>${total > 0 ? Math.round((critical/total)*100) : 0}%</td><td>Requires immediate intervention</td></tr>
          <tr><td><span class="p-indicator p-high"></span>High</td><td><strong>${high}</strong></td><td>${total > 0 ? Math.round((high/total)*100) : 0}%</td><td>Urgent attention within 48 hours</td></tr>
          <tr><td><span class="p-indicator p-medium"></span>Medium</td><td><strong>${medium}</strong></td><td>${total > 0 ? Math.round((medium/total)*100) : 0}%</td><td>Standard investigation timeline</td></tr>
          <tr><td><span class="p-indicator p-low"></span>Low</td><td><strong>${low}</strong></td><td>${total > 0 ? Math.round((low/total)*100) : 0}%</td><td>Routine processing</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-num">4. Corruption Type Analysis</div>
    <div class="section-body">
      <table class="breakdown-table">
        <thead><tr><th>Type of Corruption</th><th>Cases</th><th>%</th></tr></thead>
        <tbody>
          ${Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([name, count]) =>
          '<tr><td><span class="pct-bar" style="width:' + (total > 0 ? Math.max((count/total)*120, 8) : 0) + 'px"></span>' + name + '</td><td style="text-align:right"><strong>' + count + '</strong></td><td style="text-align:right">' + (total > 0 ? Math.round((count/total)*100) : 0) + '%</td></tr>').join('')}
        </tbody>
      </table>
    </div>
  </div>

  ${Object.keys(instMap).length > 1 ? '<div class="section"><div class="section-num">5. Institutions Cited</div><div class="section-body"><table class="breakdown-table"><thead><tr><th>Institution</th><th>Cases</th></tr></thead><tbody>' + Object.entries(instMap).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => '<tr><td>' + name + '</td><td style="text-align:right"><strong>' + count + '</strong></td></tr>').join('') + '</tbody></table></div></div>' : ''}

  ${category === 'in_progress' ? '<div class="section"><div class="section-num">' + (Object.keys(instMap).length > 1 ? '6' : '5') + '. Active Pipeline Status</div><div class="section-body"><p>Distribution of cases across investigation pipeline stages:</p><table class="priority-table"><thead><tr><th>Stage</th><th>No. of Cases</th><th>Description</th></tr></thead><tbody>' + [{ key: 'SUBMITTED', label: 'Submitted', desc: 'Awaiting initial review and triage' },{ key: 'UNDER_REVIEW', label: 'Under Review', desc: 'Being evaluated for investigation merit' },{ key: 'INVESTIGATING', label: 'Under Investigation', desc: 'Active investigation in progress' },{ key: 'REFERRED', label: 'Referred to Other Authorities', desc: 'Forwarded to competent external authorities for legal or regulatory action' }].map(s => '<tr><td><strong>' + s.label + '</strong></td><td><strong>' + (statusMap[s.key] || 0) + '</strong></td><td>' + s.desc + '</td></tr>').join('') + '</tbody></table></div></div>' : ''}

  <div class="section">
    <div class="section-num">${(() => { let n = 5; if (Object.keys(instMap).length > 1) n++; if (category === 'in_progress') n++; return n; })()}. Detailed Case Register</div>
    <div class="section-body">
      <p>The following presents the complete record of all ${total} case${total !== 1 ? 's' : ''}
      included in this report, with identifying information, classification details,
      and the full investigation audit trail where available.</p>
    </div>

    ${total <= 25 ? cases.map((c, i) =>
    '<div class="dossier"><div class="dossier-header"><div><span class="dossier-ref">' + (c.reference_code || c.case_id) + '</span><span style="font-size:9pt;color:#999;margin-left:8px;">Case ' + (i + 1) + ' of ' + total + '</span></div><div><span class="case-priority cp-' + c.priority + '">' + c.priority + '</span></div></div><div class="dossier-grid"><div class="dossier-field"><span class="df-label">Corruption Type</span><span class="df-value">' + c.type + '</span></div><div class="dossier-field"><span class="df-label">Institution</span><span class="df-value">' + (c.institution || 'Not specified') + '</span></div><div class="dossier-field"><span class="df-label">Location</span><span class="df-value">' + (c.location || 'Not specified') + '</span></div><div class="dossier-field"><span class="df-label">Current Status</span><span class="df-value">' + pdfStatusLabel(c.status) + '</span></div><div class="dossier-field"><span class="df-label">Risk Assessment</span><span class="df-value"><span class="risk-bar"><span class="risk-track"><span class="risk-fill ' + (c.risk_score > 74 ? 'risk-high' : c.risk_score > 40 ? 'risk-med' : 'risk-low') + '" style="width:' + c.risk_score + '%"></span></span>' + c.risk_score + '%</span></span></div><div class="dossier-field"><span class="df-label">Date Filed</span><span class="df-value">' + (c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }) : '\u2014') + '</span></div></div>' + (c.dispute_reason ? '<div class="dispute-box"><span class="dispute-label">Dispute Statement</span><p class="dispute-text">' + c.dispute_reason + '</p></div>' : '') + ((c.evidence_count ?? 0) > 0 ? '<div class="audit-section"><div class="audit-title">Evidence Summary</div><div style="padding:8px 10px;background:#f9f7f2;border-radius:4px;border:1px solid #e5e0d5;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-size:10pt;font-weight:bold;color:#1a472a;">' + c.evidence_count + ' Evidence File' + (c.evidence_count === 1 ? '' : 's') + ' Attached</span></div>' + (c.evidence_types && Object.keys(c.evidence_types).length > 0 ? '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + Object.entries(c.evidence_types).map(([type, count]) => '<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:8pt;font-weight:bold;background:' + (type === 'Videos' || type === 'Audio' ? '#fef3c7;color:#92400e' : type === 'Images' ? '#e0e7ff;color:#3730a3' : type === 'PDFs' ? '#fce7f3;color:#9d174d' : '#ecfdf5;color:#065f46') + ';">' + count + ' ' + type + '</span>').join('') + '</div>' : '') + '</div></div>' : '') + (c.stage_history && c.stage_history.length > 0 ? '<div class="audit-section"><div class="audit-title">Investigation Audit Trail</div>' + c.stage_history.map((s: any) => '<div class="audit-entry"><div class="a-stage">' + s.stage.replace(/_/g, ' ') + '</div><div class="a-officer">Officer: ' + s.investigator_name + (s.investigator_email ? ' (' + s.investigator_email + ')' : '') + '</div><div class="a-time">Date: ' + (s.performed_at ? new Date(s.performed_at).toLocaleString() : '\u2014') + '</div>' + (s.final_score != null ? '<div class="a-score">Assessment Score: ' + s.final_score + '/100</div>' : '') + (s.notes ? '<div class="a-notes">' + s.notes + '</div>' : '') + '</div>').join('') + '</div>' : '') + '</div>').join('')
    : '<table class="case-table"><thead><tr><th>No.</th><th>Reference</th><th>Type</th><th>Institution</th><th>Priority</th><th>Status</th><th>Risk</th><th>Evidence</th><th>Filed</th></tr></thead><tbody>' + cases.map((c, i) => '<tr><td>' + (i+1) + '</td><td><span class="case-ref">' + (c.reference_code || c.case_id) + '</span></td><td>' + c.type + '</td><td>' + (c.institution || '\u2014') + '</td><td><span class="case-priority cp-' + c.priority + '">' + c.priority + '</span></td><td>' + pdfStatusLabel(c.status) + '</td><td><span class="risk-bar"><span class="risk-track"><span class="risk-fill ' + (c.risk_score > 74 ? 'risk-high' : c.risk_score > 40 ? 'risk-med' : 'risk-low') + '" style="width:' + c.risk_score + '%"></span></span><span style="font-size:9pt;font-weight:bold;">' + c.risk_score + '%</span></span></td><td style="text-align:center;font-weight:bold;">' + (c.evidence_count || 0) + '</td><td style="white-space:nowrap;">' + (c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '\u2014') + '</td></tr>').join('') + '</tbody></table>'}
  </div>

  <div class="section">
    <div class="section-num">${(() => { let n = 6; if (Object.keys(instMap).length > 1) n++; if (category === 'in_progress') n++; return n; })()}. Observations</div>
    <div class="section-body">
      <p>Based on the data presented in this report, the following observations are noted:</p>
      <p>i) A total of <strong>${total}</strong> case${total !== 1 ? 's' : ''} fall${total === 1 ? 's' : ''} under the
      <strong>${categoryLabel}</strong> classification, with an average risk assessment score of <strong>${avgRisk}%</strong>.</p>
      ${critical + high > 0 ? '<p>ii) <strong>' + (critical + high) + '</strong> case' + ((critical + high) !== 1 ? 's' : '') + ' (' + (total > 0 ? Math.round(((critical + high)/total)*100) : 0) + '%) ' + ((critical + high) !== 1 ? 'are' : 'is') + ' classified as Critical or High priority, warranting expedited attention.</p>' : ''}
      ${Object.keys(typeMap).length > 0 ? '<p>' + (critical + high > 0 ? 'iii' : 'ii') + ') The most prevalent corruption type is <strong>' + Object.entries(typeMap).sort((a, b) => b[1] - a[1])[0][0] + '</strong>, accounting for <strong>' + Object.entries(typeMap).sort((a, b) => b[1] - a[1])[0][1] + '</strong> case' + (Object.entries(typeMap).sort((a, b) => b[1] - a[1])[0][1] !== 1 ? 's' : '') + '.</p>' : ''}
    </div>
  </div>

  <div class="signature-block">
    <p style="font-size:10pt;font-weight:bold;color:#1a472a;margin-bottom:4px;">AUTHORISATION</p>
    <p style="font-size:9pt;color:#555;">This report has been compiled in accordance with ZACC standard operating procedures
    and is submitted for the attention and action of the indicated authorising officers.</p>
    <div class="sig-grid">
      <div class="sig-item"><div class="sig-line"><div class="sig-name">${officer}</div><div class="sig-title">Preparing Officer</div><div class="sig-date">Date: ${dateStr}</div></div></div>
      <div class="sig-item"><div class="sig-line"><div class="sig-name">____________________</div><div class="sig-title">Authorising Officer</div><div class="sig-date">Date: ____________________</div></div></div>
    </div>
  </div>

  <div class="doc-footer">
    <div>Zimbabwe Anti-Corruption Commission<br/>This document is confidential. Unauthorised disclosure is an offence under the Official Secrets Act.</div>
    <div style="text-align:right;">Ref: ${reportId}<br/>Generated: ${now}<br/>Page 1 of 1</div>
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
    <div className="space-y-5 sm:space-y-6">
      {/* Filters */}
      <div className="zacc-surface p-4 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              {t(language, "from")}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] text-sm text-slate-900 dark:text-white"
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
              className="w-full px-3 py-2 rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              {t(language, "type")}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] text-sm text-slate-900 dark:text-white"
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
            className="w-full px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
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
                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                : "bg-[var(--zacc-card)] border-[var(--zacc-border)] text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-400/40"
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
                
                color: "text-slate-900 dark:text-white",
              },
              {
                label: t(language, "successful"),
                value: data.overview.successful,
                
                color: "text-emerald-500",
              },
              {
                label: t(language, "inProgress"),
                value: data.overview.in_progress,
                // icon: "â³",
                color: "text-amber-500",
              },
              {
                label: t(language, "disputed"),
                value: data.overview.disputed,
                
                color: "text-rose-500",
              },
            ].map((s, i) => (
              <div key={i} className="zacc-surface p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  {/* <span className="text-xl">{s.icon}</span> */}
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
            
            <div className="zacc-surface rounded-2xl p-5 border border-cyan-300/40 dark:border-cyan-500/30">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t(language, "successRate")}
              </p>
              <p className="text-3xl font-black text-blue-500">
                {data.overview.success_rate}%
              </p>
            </div>
            <div className="zacc-surface rounded-2xl p-5 border border-amber-500/30">
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
            <div className="zacc-surface p-6 rounded-3xl">
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
            <div className="zacc-surface p-6 rounded-3xl">
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
            <div className="zacc-surface p-6 rounded-3xl">
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
            >
            {t(language, "exportPdf")}
            </button>
          </div>

          <div className="zacc-surface rounded-2xl overflow-hidden">
            {getCasesForTab(activeTab).length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 font-medium">
                  {t(language, "noCasesInCategory")}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--zacc-card-soft)] border-b border-[var(--zacc-border)]">
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
                          <code className="text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">
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
