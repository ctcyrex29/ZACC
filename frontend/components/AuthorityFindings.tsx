import React, { useEffect, useMemo, useState } from "react";
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

  const loadCases = async () => {
    setLoading(true);
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
            last_updated: r.last_updated,
          }));
        setCases(referred);
      } else {
        setCases([]);
      }
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="zacc-surface rounded-2xl p-5">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Referred Case Findings
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Referred cases are managed and completed here. Record proceedings, print table-format reports, and finalize outcomes.
        </p>
      </div>

      {loading ? (
        <div className="zacc-surface rounded-2xl p-10 text-center text-slate-500">Loading referred cases...</div>
      ) : cases.length === 0 ? (
        <div className="zacc-surface rounded-2xl p-10 text-center text-slate-500">No referred cases available.</div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const id = String(c.case_id || c.id);
            const d = drafts[id] || defaultDraft();
            const saving = savingCaseId === id;

            return (
              <div key={id} className="zacc-surface rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {c.reference_code || id}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.type}</p>
                    <p className="text-xs text-slate-500">{c.institution}</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Last updated: {c.last_updated ? new Date(c.last_updated).toLocaleString() : "N/A"}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-white/5">
                      <tr>
                        <th className="text-left px-3 py-2 uppercase tracking-wider">Case Ref</th>
                        <th className="text-left px-3 py-2 uppercase tracking-wider">Type</th>
                        <th className="text-left px-3 py-2 uppercase tracking-wider">Institution</th>
                        <th className="text-left px-3 py-2 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.reference_code || id}</td>
                        <td className="px-3 py-2">{c.type || "N/A"}</td>
                        <td className="px-3 py-2">{c.institution || "N/A"}</td>
                        <td className="px-3 py-2">REFERRED</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Authority</label>
                    <select
                      value={d.authority}
                      onChange={(e) => updateDraft(id, { authority: e.target.value })}
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
                      value={d.transmissionDate}
                      onChange={(e) => updateDraft(id, { transmissionDate: e.target.value })}
                      className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Referral Reference</label>
                  <input
                    value={d.reference}
                    onChange={(e) => updateDraft(id, { reference: e.target.value })}
                    placeholder="e.g. ZACC/REF/2026/CASE-01"
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Legal / Regulatory Basis</label>
                  <textarea
                    rows={2}
                    value={d.legalBasis}
                    onChange={(e) => updateDraft(id, { legalBasis: e.target.value })}
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Authority Proceedings</label>
                  <textarea
                    rows={4}
                    value={d.finding}
                    onChange={(e) => updateDraft(id, { finding: e.target.value })}
                    placeholder="Log current proceedings from the receiving authority..."
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Outcome Notes (for completion)</label>
                  <textarea
                    rows={3}
                    value={d.outcomeNotes}
                    onChange={(e) => updateDraft(id, { outcomeNotes: e.target.value })}
                    placeholder="When ready to complete, record final authority outcome here..."
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => printAuthorityReport(c, d)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider"
                  >
                    Print Table Report
                  </button>
                  <button
                    onClick={() => submitFinding(id, "REFERRED")}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Log Proceeding"}
                  </button>
                  <button
                    onClick={() => submitFinding(id, "SUCCESSFUL")}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Mark Successful"}
                  </button>
                  <button
                    onClick={() => submitFinding(id, "CLOSED")}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Close Case"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
