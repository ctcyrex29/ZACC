import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "../services/api";
import { CaseStatus } from "../types";

type ReferralDraft = {
  authority: string;
  legalBasis: string;
  reference: string;
  transmissionDate: string;
  finding: string;
  outcomeNotes: string;
};

const defaultDraft = (): ReferralDraft => ({
  authority: "National Prosecuting Authority (NPA)",
  legalBasis:
    "Update from receiving authority in line with formal referral and legal mandate.",
  reference: "",
  transmissionDate: new Date().toISOString().slice(0, 10),
  finding: "",
  outcomeNotes: "",
});

export const AuthorityFindings: React.FC = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCaseId, setSavingCaseId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReferralDraft>>({});
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const loadCases = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resp = await apiClient.getReports();
      if (resp?.success && Array.isArray(resp.data)) {
        const referred = resp.data
          .filter((r: any) => r.status === CaseStatus.REFERRED)
          .map((r: any) => ({
            id: r.case_id || r.id,
            case_id: r.case_id,
            reference_code: r.reference_code,
            institution: r.institution,
            type: r.type,
            status: r.status,
            priority: r.priority,
            risk_score: r.risk_score,
            location: r.location,
            attachments_count: r.attachments_count ?? r.attachments?.length ?? 0,
            created_at: r.created_at,
            last_updated: r.last_updated,
          }));
        setCases(referred);
      } else {
        setCases([]);
      }
    } catch {
      setCases([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCases(true);
      }
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [loadCases]);

  const caseIds = useMemo(() => cases.map((c) => String(c.case_id || c.id)), [cases]);

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, ReferralDraft> = {};
      for (const id of caseIds) {
        next[id] = prev[id] || defaultDraft();
      }
      return next;
    });
  }, [caseIds]);

  useEffect(() => {
    if (cases.length === 0) {
      setSelectedCaseId(null);
      return;
    }

    const exists = selectedCaseId && cases.some((c) => String(c.case_id || c.id) === selectedCaseId);
    if (!exists) {
      setSelectedCaseId(String(cases[0].case_id || cases[0].id));
    }
  }, [cases, selectedCaseId]);

  const updateDraft = (id: string, patch: Partial<ReferralDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || defaultDraft()), ...patch },
    }));
  };

  const printAuthorityReport = (c: any, d: ReferralDraft) => {
    const now = new Date().toLocaleString();
    const win = window.open("", "_blank", "width=1000,height=780");
    if (!win) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Authority Findings Report - ${c.reference_code || c.case_id || c.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;padding:28px;color:#111;background:#fff;}
    h1{font-size:20px;color:#0f766e;margin-bottom:6px;}
    p.meta{font-size:12px;color:#64748b;margin-bottom:16px;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}
    th{background:#f1f5f9;text-align:left;padding:9px;border:1px solid #e2e8f0;font-size:10px;text-transform:uppercase;letter-spacing:1px;}
    td{padding:9px;border:1px solid #e2e8f0;vertical-align:top;}
    .notes{padding:12px;border:1px solid #e2e8f0;border-left:4px solid #0f766e;background:#f8fafc;min-height:90px;white-space:pre-wrap;line-height:1.5;font-size:12px;}
  </style>
</head>
<body>
  <h1>Authority Findings Report</h1>
  <p class="meta">Generated: ${now}</p>

  <table>
    <thead><tr><th>Case Reference</th><th>Case ID</th><th>Type</th><th>Institution</th></tr></thead>
    <tbody><tr><td>${c.reference_code || "—"}</td><td>${c.case_id || c.id || "—"}</td><td>${c.type || "—"}</td><td>${c.institution || "—"}</td></tr></tbody>
  </table>

  <table>
    <thead><tr><th>Receiving Authority</th><th>Transmission Date</th><th>Referral Reference</th></tr></thead>
    <tbody><tr><td>${d.authority || "—"}</td><td>${d.transmissionDate || "—"}</td><td>${d.reference || "—"}</td></tr></tbody>
  </table>

  <table>
    <thead><tr><th>Legal / Regulatory Basis</th></tr></thead>
    <tbody><tr><td>${d.legalBasis || "—"}</td></tr></tbody>
  </table>

  <table>
    <thead><tr><th>Case Proceedings (Authority Findings)</th></tr></thead>
  </table>
  <div class="notes">${d.finding || "No proceedings logged yet."}</div>

  <table style="margin-top:14px;">
    <thead><tr><th>Outcome Notes</th></tr></thead>
  </table>
  <div class="notes">${d.outcomeNotes || "No outcome recorded yet."}</div>

  <script>window.onload=()=>setTimeout(()=>window.print(),500);</script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
  };

  const submitFinding = async (id: string, targetStage: "REFERRED" | "SUCCESSFUL" | "CLOSED") => {
    const d = drafts[id] || defaultDraft();

    if (d.reference.trim().length < 3) {
      toast.error("Please enter a valid referral reference.");
      return;
    }
    if (d.legalBasis.trim().length < 10) {
      toast.error("Please enter legal/regulatory basis.");
      return;
    }
    if (targetStage === "REFERRED" && d.finding.trim().length < 10) {
      toast.error("Please enter findings (minimum 10 characters).");
      return;
    }
    if ((targetStage === "SUCCESSFUL" || targetStage === "CLOSED") && d.outcomeNotes.trim().length < 10) {
      toast.error("Please enter outcome notes (minimum 10 characters).");
      return;
    }

    setSavingCaseId(id);
    try {
      const resp = await apiClient.createStageEvaluation(id, {
        stage: targetStage,
        investigator_notes: targetStage === "REFERRED" ? d.finding : d.outcomeNotes,
        referral_authority: d.authority,
        referral_legal_basis: d.legalBasis,
        referral_reference: d.reference,
        referral_transmission_date: d.transmissionDate,
      });

      if (resp?.success) {
        if (targetStage === "REFERRED") {
          toast.success("Authority proceedings logged.");
          updateDraft(id, { finding: "" });
        } else {
          toast.success(targetStage === "SUCCESSFUL" ? "Case marked successful." : "Case closed.");
          await loadCases();
        }
      } else {
        toast.error(resp?.message || "Failed to log findings.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to log findings.");
    } finally {
      setSavingCaseId(null);
    }
  };

  const selectedCase = selectedCaseId
    ? cases.find((c) => String(c.case_id || c.id) === selectedCaseId)
    : null;
  const selectedId = selectedCase ? String(selectedCase.case_id || selectedCase.id) : "";
  const selectedDraft = selectedId ? drafts[selectedId] || defaultDraft() : defaultDraft();
  const selectedSaving = selectedId && savingCaseId === selectedId;

  return (
    <div className="space-y-6">
      <div className="zacc-surface rounded-2xl p-5">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Referred Cases
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Referred cases are managed and completed here. Select a case from the table, log proceedings, and finalize outcomes.
        </p>
      </div>

      {loading ? (
        <div className="zacc-surface rounded-2xl p-10 text-center text-slate-500">Loading referred cases...</div>
      ) : cases.length === 0 ? (
        <div className="zacc-surface rounded-2xl p-10 text-center text-slate-500">No referred cases available.</div>
      ) : (
        <div className="space-y-4">
          <div className="zacc-surface rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--zacc-card-soft)] border-b border-[var(--zacc-border)]">
                  <tr>
                    {[
                      "#",
                      "Case Ref",
                      "Type",
                      "Institution",
                      "Priority",
                      "Risk",
                      "Evidence",
                      "Last Updated",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3.5 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {cases.map((c: any, idx: number) => {
                    const id = String(c.case_id || c.id);
                    const isSelected = id === selectedCaseId;
                    return (
                      <tr
                        key={id}
                        className={`transition-colors ${isSelected ? "bg-blue-50/70 dark:bg-blue-500/10" : "hover:bg-blue-50/60 dark:hover:bg-blue-500/8"}`}
                      >
                        <td className="px-5 py-4 text-xs text-slate-500 font-bold">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <code className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                            {c.reference_code || id}
                          </code>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{c.type || "N/A"}</td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-[220px] truncate">{c.institution || "N/A"}</td>
                        <td className="px-5 py-4 text-xs font-black uppercase">{c.priority || "N/A"}</td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300">{c.risk_score ?? 0}/100</td>
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                          {c.attachments_count ?? 0} file{(c.attachments_count ?? 0) === 1 ? "" : "s"}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {c.last_updated ? new Date(c.last_updated).toLocaleString() : "N/A"}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setSelectedCaseId(id)}
                            className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                              isSelected
                                ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                : "border-slate-300/60 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                          >
                            {isSelected ? "Selected" : "Manage"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedCase && (
            <div className="zacc-surface rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Selected Referred Case</p>
                  <p className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {selectedCase.reference_code || selectedId}
                  </p>
                </div>
                <button
                  onClick={() => printAuthorityReport(selectedCase, selectedDraft)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider"
                >
                  Print Table Report
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Authority</label>
                  <select
                    value={selectedDraft.authority}
                    onChange={(e) => updateDraft(selectedId, { authority: e.target.value })}
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm"
                  >
                    <option>National Prosecuting Authority (NPA)</option>
                    <option>Zimbabwe Republic Police (ZRP)</option>
                    <option>Financial Intelligence Unit (FIU)</option>
                    <option>Zimbabwe Revenue Authority (ZIMRA)</option>
                    <option>Auditor-General</option>
                    <option>Other Competent Authority</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Transmission Date</label>
                  <input
                    type="date"
                    value={selectedDraft.transmissionDate}
                    onChange={(e) => updateDraft(selectedId, { transmissionDate: e.target.value })}
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Referral Reference</label>
                <input
                  value={selectedDraft.reference}
                  onChange={(e) => updateDraft(selectedId, { reference: e.target.value })}
                  placeholder="e.g. ZACC/REF/2026/CASE-01"
                  className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Legal / Regulatory Basis</label>
                <textarea
                  rows={2}
                  value={selectedDraft.legalBasis}
                  onChange={(e) => updateDraft(selectedId, { legalBasis: e.target.value })}
                  className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Authority Proceedings</label>
                <textarea
                  rows={4}
                  value={selectedDraft.finding}
                  onChange={(e) => updateDraft(selectedId, { finding: e.target.value })}
                  placeholder="Log current proceedings from the receiving authority..."
                  className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Outcome Notes (for completion)</label>
                <textarea
                  rows={3}
                  value={selectedDraft.outcomeNotes}
                  onChange={(e) => updateDraft(selectedId, { outcomeNotes: e.target.value })}
                  placeholder="When ready to complete, record final authority outcome here..."
                  className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => submitFinding(selectedId, "REFERRED")}
                  disabled={Boolean(selectedSaving)}
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                >
                  {selectedSaving ? "Saving..." : "Log Proceeding"}
                </button>
                <button
                  onClick={() => submitFinding(selectedId, "SUCCESSFUL")}
                  disabled={Boolean(selectedSaving)}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                >
                  {selectedSaving ? "Saving..." : "Mark Successful"}
                </button>
                <button
                  onClick={() => submitFinding(selectedId, "CLOSED")}
                  disabled={Boolean(selectedSaving)}
                  className="px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                >
                  {selectedSaving ? "Saving..." : "Close Case"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
