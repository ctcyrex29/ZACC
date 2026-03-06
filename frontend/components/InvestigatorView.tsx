import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/api";
import { CaseReport, CaseStatus } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────
const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: "Submitted", UNDER_REVIEW: "Under Review",
    INVESTIGATING: "Investigating", REFERRED: "Referred",
    CLOSED: "Closed", DISPUTED: "Disputed",
  };
  return map[s] ?? s;
};

const statusBadge = (s: string) => {
  if (s === "SUBMITTED")   return "bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-200   dark:border-blue-500/20";
  if (s === "UNDER_REVIEW") return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20";
  if (s === "INVESTIGATING") return "bg-amber-500/10 text-amber-600  dark:text-amber-400  border-amber-200  dark:border-amber-500/20";
  if (s === "REFERRED")    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20";
  if (s === "CLOSED")      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
  if (s === "DISPUTED")    return "bg-rose-500/10   text-rose-600   dark:text-rose-400   border-rose-200   dark:border-rose-500/20";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20";
};

const priorityColor = (p: string) => {
  if (p === "CRITICAL") return "text-rose-600 dark:text-rose-400";
  if (p === "HIGH")     return "text-orange-600 dark:text-orange-400";
  if (p === "MEDIUM")   return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

// ── PDF Generator ─────────────────────────────────────────────────────────
function generateStagePDF(caseData: any, stage: any) {
  const inv = stage.investigator;
  const invName  = inv?.name  || "Investigator";
  const invEmail = inv?.email || "";
  const win = window.open("", "_blank", "width=900,height=750");
  if (!win) return;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>ZACC Stage Report – ${caseData.reference_code || caseData.case_id}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;color:#111;padding:52px;background:#fff;}
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;color:rgba(0,0,0,0.035);pointer-events:none;font-weight:900;letter-spacing:4px;white-space:nowrap;}
    .header{border-bottom:3px solid #059669;padding-bottom:20px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:flex-end;}
    .header-left h1{font-size:20px;font-weight:900;color:#059669;letter-spacing:2px;text-transform:uppercase;}
    .header-left h2{font-size:13px;color:#555;margin-top:4px;}
    .confid{font-size:10px;font-weight:900;color:#e11d48;letter-spacing:3px;text-transform:uppercase;margin-top:6px;}
    .header-right{text-align:right;font-size:11px;color:#888;}
    .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-bottom:24px;}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;}
    .field .label{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#777;margin-bottom:4px;}
    .field .value{font-size:13px;color:#111;font-weight:600;}
    .divider{height:1px;background:#e2e8f0;margin:24px 0;}
    .notes-box{background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #059669;border-radius:4px;padding:16px;font-size:13px;line-height:1.7;color:#333;margin-top:6px;}
    .section-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#059669;margin-bottom:12px;}
    .footer{margin-top:52px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:10px;color:#aaa;display:flex;justify-content:space-between;}
    @media print{body{padding:36px;}}
  </style>
</head>
<body>
<div class="watermark">CONFIDENTIAL</div>
<div class="header">
  <div class="header-left">
    <h1>Zimbabwe Anti-Corruption Commission</h1>
    <h2>Official Case Stage Report</h2>
    <div class="confid">Confidential — For Official Use Only</div>
  </div>
  <div class="header-right">
    Report Generated:<br/><strong>${new Date().toLocaleString()}</strong>
  </div>
</div>

<div class="row3">
  <div class="field"><div class="label">Case Reference</div><div class="value" style="color:#059669;font-size:15px;">${caseData.reference_code || "—"}</div></div>
  <div class="field"><div class="label">Case ID</div><div class="value">${caseData.case_id || caseData.id || "—"}</div></div>
  <div class="field"><div class="label">Corruption Type</div><div class="value">${caseData.type || "—"}</div></div>
</div>

<div class="divider"></div>
<div class="section-title">Stage Action</div>
<div class="row3">
  <div class="field"><div class="label">Stage</div><div class="value" style="font-size:15px;color:#1e293b;">${statusLabel(stage.stage)}</div></div>
  <div class="field"><div class="label">Action Date &amp; Time</div><div class="value">${new Date(stage.created_at).toLocaleString()}</div></div>
  <div class="field"><div class="label">Assessment Score</div><div class="value">${stage.final_score != null ? stage.final_score + " / 100" : "—"}</div></div>
</div>

<div class="divider"></div>
<div class="section-title">Action Performed By</div>
<div class="row2" style="margin-bottom:24px;">
  <div class="field"><div class="label">Officer Name</div><div class="value">${invName}</div></div>
  <div class="field"><div class="label">Officer Email</div><div class="value">${invEmail}</div></div>
</div>

<div class="divider"></div>
<div class="section-title">Report Statement</div>
<div class="notes-box">${stage.investigator_notes || "No statement recorded."}</div>

<div class="footer">
  <span>Zimbabwe Anti-Corruption Commission · Integrity Management System</span>
  <span>Document Ref: ${caseData.reference_code || caseData.case_id}-${stage.stage}-${new Date().getFullYear()}</span>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),500);</script>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ── Component ──────────────────────────────────────────────────────────────
export const InvestigatorView: React.FC = () => {
  const [cases, setCases]     = useState<CaseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<CaseStatus | "ALL">("ALL");
  const [search, setSearch]   = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);

  // Dossier modal
  const [dossierOpen, setDossierOpen]     = useState(false);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData]     = useState<any | null>(null);
  const [stagesData, setStagesData]       = useState<any[]>([]);

  // Action state
  const [actionNotes, setActionNotes]       = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionError, setActionError]       = useState<string | null>(null);

  // ── Fetch cases ──
  const fetchCases = useCallback(async () => {
    try {
      const response = await apiClient.getReports();
      if (response?.success && Array.isArray(response.data)) {
        setCases(response.data.map((r: any) => ({
          id: r.case_id || r.id,
          case_id: r.case_id,
          timestamp: r.created_at,
          type: r.type,
          description: r.description || "",
          location: r.location || "",
          institution: r.institution || "",
          status: r.status,
          riskScore: r.risk_score,
          priority: r.priority,
          reporterId: r.user_id,
          referenceCode: r.reference_code,
        })));
      } else {
        setCases(JSON.parse(localStorage.getItem("zacc_cases") || "[]"));
      }
    } catch {
      setCases(JSON.parse(localStorage.getItem("zacc_cases") || "[]"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.getNotifications();
      if (response?.success && Array.isArray(response.data)) {
        setNotifications(response.data);
      }
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchNotifications]);

  // ── Load stages for open dossier ──
  const loadStages = useCallback(async (reportId: string) => {
    try {
      const resp = await apiClient.getStageEvaluations(reportId);
      if (resp?.success && Array.isArray(resp.data)) {
        setStagesData(resp.data);
      }
    } catch {
      setStagesData([]);
    }
  }, []);

  // ── Open dossier ──
  const openDossier = async (c: CaseReport) => {
    setDossierOpen(true);
    setDossierLoading(true);
    setDossierData(null);
    setStagesData([]);
    setActionNotes("");
    setActionError(null);

    const resolvedId = (c as any).case_id || c.id;

    // If SUBMITTED → auto-advance to UNDER_REVIEW
    if (c.status === CaseStatus.SUBMITTED) {
      try {
        await apiClient.createStageEvaluation(resolvedId, {
          stage: "UNDER_REVIEW",
          investigator_notes: "Case dossier opened. Proceeding to validity review.",
        });
        setCases(prev => prev.map(x =>
          (x.id === c.id || (x as any).case_id === resolvedId)
            ? { ...x, status: CaseStatus.UNDER_REVIEW }
            : x));
      } catch {
        // continue even if status update fails
      }
    }

    try {
      const resp = await apiClient.get(`/reports/${resolvedId}`);
      if (resp?.success) {
        setDossierData(resp.data);
        await loadStages(resolvedId);
      } else {
        setDossierData({ error: resp?.message || "Failed to load case" });
      }
    } catch (err: any) {
      setDossierData({ error: err.message || "Failed to load case" });
    } finally {
      setDossierLoading(false);
    }
  };

  // ── Stage action ──
  const doAction = async (targetStage: string, requireNotes = true) => {
    if (requireNotes && actionNotes.trim().length < 10) {
      setActionError("Please provide a report statement (minimum 10 characters) before proceeding.");
      return;
    }
    setActionProcessing(true);
    setActionError(null);
    const id = dossierData?.case_id || dossierData?.id;
    try {
      const resp = await apiClient.createStageEvaluation(id, {
        stage: targetStage,
        investigator_notes: actionNotes.trim() || "Stage advanced by investigator.",
      });
      if (resp?.success) {
        const updatedStatus = targetStage as CaseStatus;
        setDossierData((prev: any) => ({ ...prev, status: updatedStatus }));
        setCases(prev => prev.map(x =>
          (x.id === id || (x as any).case_id === id)
            ? { ...x, status: updatedStatus }
            : x));
        setActionNotes("");
        await loadStages(id);
      } else {
        setActionError(resp?.message || "Action failed.");
      }
    } catch (err: any) {
      setActionError(err.message || "Action failed.");
    } finally {
      setActionProcessing(false);
    }
  };

  const closeDossier = () => {
    setDossierOpen(false);
    setDossierData(null);
    setStagesData([]);
    setActionNotes("");
    setActionError(null);
  };

  // ── Derived lists ──
  const filteredCases = cases.filter(c => {
    const matchesFilter = filter === "ALL" || c.status === filter;
    const matchesSearch = !search ||
      c.type?.toLowerCase().includes(search.toLowerCase()) ||
      c.institution?.toLowerCase().includes(search.toLowerCase()) ||
      (c.referenceCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.id || "").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const currentStatus: string = dossierData?.status ?? "";
  const decrypted = dossierData?.decrypted_data ?? {};
  const newCaseNotifications = notifications.filter((n) =>
    ["NEW_CASE_SUBMITTED", "ANONYMOUS_REPORT_SUBMITTED"].includes(n.type),
  );

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">New Case Notifications</h3>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {newCaseNotifications.length} alerts
          </span>
        </div>
        {newCaseNotifications.length === 0 ? (
          <p className="text-sm text-slate-500">No new case alerts right now.</p>
        ) : (
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {newCaseNotifications.slice(0, 8).map((n) => (
              <div key={n.id} className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 truncate">{n.title}</p>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 line-clamp-2">{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Header & Filters ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Investigation Pipeline</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Review and manage reported cases through the investigation workflow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases..."
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500" />
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Cases", value: cases.length, color: "text-slate-900 dark:text-white" },
          { label: "Under Review", value: cases.filter(c => c.status === CaseStatus.UNDER_REVIEW).length, color: "text-indigo-600 dark:text-indigo-400" },
          { label: "Investigating", value: cases.filter(c => c.status === CaseStatus.INVESTIGATING).length, color: "text-amber-600 dark:text-amber-400" },
          { label: "High / Critical", value: cases.filter(c => c.priority === "HIGH" || c.priority === "CRITICAL").length, color: "text-rose-600 dark:text-rose-400" },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Status Filters ── */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", ...Object.values(CaseStatus)] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${filter === s ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20"}`}>
            {s === "ALL" ? "All" : statusLabel(s)}
          </button>
        ))}
      </div>

      {/* ── Cases Table ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-bold text-slate-500">Loading cases...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">No cases found{filter !== "ALL" ? ` with status "${statusLabel(filter)}"` : ""}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <tr>
                  {["#", "Case Ref", "Type", "Institution", "Priority", "Status", "Date", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredCases.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4 text-xs text-slate-500 font-bold">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <code className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                        {c.referenceCode || c.id}
                      </code>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{c.type}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-[180px] truncate">{c.institution}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-black uppercase ${priorityColor(c.priority)}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(c.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => openDossier(c)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap">
                        View Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dossier Modal ── */}
      {dossierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) closeDossier(); }}>
          <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white dark:bg-[#080c18] border border-slate-200 dark:border-white/10 overflow-y-auto shadow-2xl">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-[#080c18] border-b border-slate-200 dark:border-white/10 px-8 py-5 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Case Dossier</h3>
                {dossierData && !dossierData.error && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{dossierData.reference_code || dossierData.case_id}</code>
                    &nbsp;·&nbsp;
                    <span className={`font-bold ${statusBadge(currentStatus).split(" ")[1]}`}>{statusLabel(currentStatus)}</span>
                  </p>
                )}
              </div>
              <button onClick={closeDossier} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-lg font-black transition-all">×</button>
            </div>

            <div className="p-8">
              {dossierLoading ? (
                <div className="py-20 flex flex-col items-center gap-4 text-center">
                  <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-500">Loading dossier...</p>
                </div>
              ) : dossierData?.error ? (
                <div className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-200 dark:border-rose-500/20">
                  <p className="text-rose-700 dark:text-rose-300 font-medium">{dossierData.error}</p>
                </div>
              ) : dossierData ? (
                <div className="space-y-6">

                  {/* Case Info */}
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: "Priority", value: dossierData.priority, className: priorityColor(dossierData.priority) + " font-black uppercase" },
                        { label: "Risk Score", value: `${dossierData.risk_score}%`, className: "font-black text-slate-900 dark:text-white" },
                        { label: "Type", value: dossierData.type, className: "font-semibold text-slate-900 dark:text-white" },
                      ].map(f => (
                        <div key={f.label}>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</p>
                          <p className={`text-base ${f.className}`}>{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Institution</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{decrypted.institution || dossierData.institution}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Location</p>
                      <p className="text-slate-700 dark:text-slate-300">{decrypted.location || dossierData.location || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {decrypted.description || dossierData.description || "No description available."}
                      </p>
                    </div>
                  </div>

                  {/* ── Workflow Panel ── */}
                  {actionError && (
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-5 py-3 text-sm text-rose-700 dark:text-rose-300 font-semibold">
                      ⚠️ {actionError}
                    </div>
                  )}

                  {/* UNDER_REVIEW: validity assessment */}
                  {currentStatus === "UNDER_REVIEW" && (
                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 p-5 space-y-4">
                      <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Validity Assessment</p>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">Review the case and determine whether it is valid and warrants investigation. Provide your assessment report below.</p>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                          Validity Report <span className="text-rose-500">*</span>
                        </label>
                        <textarea rows={4} value={actionNotes} onChange={e => setActionNotes(e.target.value)} disabled={actionProcessing}
                          placeholder="State whether the case is valid, your assessment findings, and the basis for your decision (min 10 characters)..."
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-medium" />
                        <p className="text-xs text-slate-500 mt-1">{actionNotes.length} characters</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => doAction("INVESTIGATING")} disabled={actionProcessing}
                          className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50">
                          {actionProcessing ? "Processing..." : "✓ Valid — Proceed to Investigation"}
                        </button>
                        <button onClick={() => doAction("CLOSED")} disabled={actionProcessing}
                          className="py-3 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50">
                          {actionProcessing ? "Processing..." : "✗ Invalid — Close Case"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* INVESTIGATING: investigation report */}
                  {currentStatus === "INVESTIGATING" && (
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-5 space-y-4">
                      <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Investigation Stage</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">Conduct the investigation and record your findings. Once complete, proceed to the review board or close the case if insufficient evidence found.</p>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                          Investigation Report <span className="text-rose-500">*</span>
                        </label>
                        <textarea rows={4} value={actionNotes} onChange={e => setActionNotes(e.target.value)} disabled={actionProcessing}
                          placeholder="Document your investigation findings, evidence collected, witnesses interviewed, and conclusions reached (min 10 characters)..."
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none font-medium" />
                        <p className="text-xs text-slate-500 mt-1">{actionNotes.length} characters</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => doAction("REFERRED")} disabled={actionProcessing}
                          className="py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50">
                          {actionProcessing ? "Processing..." : "→ Proceed to Review Board"}
                        </button>
                        <button onClick={() => doAction("CLOSED")} disabled={actionProcessing}
                          className="py-3 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50">
                          {actionProcessing ? "Processing..." : "✗ Close Case — Insufficient Evidence"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* REFERRED */}
                  {currentStatus === "REFERRED" && (
                    <div className="rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 p-5">
                      <p className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-2">Referred to Review Board</p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">This case has been referred to the ZACC Review Board for final determination. No further investigator action is required at this stage.</p>
                    </div>
                  )}

                  {/* CLOSED */}
                  {currentStatus === "CLOSED" && (
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-5">
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2">Case Closed</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">This case has been closed. The whistleblower may file a dispute if they disagree with the outcome.</p>
                    </div>
                  )}

                  {/* DISPUTED */}
                  {currentStatus === "DISPUTED" && (
                    <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-5">
                      <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest mb-2">Dispute Filed</p>
                      <p className="text-sm text-rose-700 dark:text-rose-300 mb-3">The whistleblower has disputed the outcome of this case.</p>
                      {dossierData.dispute_reason && (
                        <div className="rounded-xl bg-white dark:bg-black/20 border border-rose-200 dark:border-rose-500/20 px-4 py-3">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dispute Statement</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{dossierData.dispute_reason}</p>
                        </div>
                      )}
                      <div className="mt-4">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                          Response / Resolution Notes <span className="text-rose-500">*</span>
                        </label>
                        <textarea rows={3} value={actionNotes} onChange={e => setActionNotes(e.target.value)} disabled={actionProcessing}
                          placeholder="Provide your response to the dispute..."
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 resize-none font-medium" />
                        <button onClick={() => doAction("CLOSED")} disabled={actionProcessing}
                          className="w-full mt-3 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50">
                          {actionProcessing ? "Processing..." : "Close Dispute — Uphold Original Decision"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Stage History ── */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Stage History</p>
                    {stagesData.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No stage records yet.</p>
                    ) : (
                      stagesData.map((stage: any, idx: number) => (
                        <div key={stage.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusBadge(stage.stage)}`}>
                                  {statusLabel(stage.stage)}
                                </span>
                                {stage.investigator && (
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    by {stage.investigator.name}
                                    {stage.investigator.email ? ` (${stage.investigator.email})` : ""}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500">
                                  {new Date(stage.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {stage.investigator_notes}
                              </p>
                              {stage.final_score != null && (
                                <p className="text-xs text-slate-500 mt-2">
                                  Score: <strong className="text-emerald-600 dark:text-emerald-400">{stage.final_score}/100</strong>
                                </p>
                              )}
                            </div>
                            <button onClick={() => generateStagePDF(dossierData, stage)}
                              className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all whitespace-nowrap">
                              PDF Report
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
