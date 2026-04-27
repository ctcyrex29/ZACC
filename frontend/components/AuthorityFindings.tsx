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
};

const defaultDraft = (): ReferralDraft => ({
  authority: "National Prosecuting Authority (NPA)",
  legalBasis:
    "Update from receiving authority in line with formal referral and legal mandate.",
  reference: "",
  transmissionDate: new Date().toISOString().slice(0, 10),
  finding: "",
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

  const submitFinding = async (id: string) => {
    const d = drafts[id] || defaultDraft();

    if (d.reference.trim().length < 3) {
      toast.error("Please enter a valid referral reference.");
      return;
    }
    if (d.legalBasis.trim().length < 10) {
      toast.error("Please enter legal/regulatory basis.");
      return;
    }
    if (d.finding.trim().length < 10) {
      toast.error("Please enter findings (minimum 10 characters).");
      return;
    }

    setSavingCaseId(id);
    try {
      const resp = await apiClient.createStageEvaluation(id, {
        stage: "REFERRED",
        investigator_notes: d.finding,
        referral_authority: d.authority,
        referral_legal_basis: d.legalBasis,
        referral_reference: d.reference,
        referral_transmission_date: d.transmissionDate,
      });

      if (resp?.success) {
        toast.success("Authority findings logged.");
        updateDraft(id, { finding: "" });
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
          Log updates from other authorities for cases currently in referred status.
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
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Authority Findings</label>
                  <textarea
                    rows={4}
                    value={d.finding}
                    onChange={(e) => updateDraft(id, { finding: e.target.value })}
                    placeholder="Record the external authority findings, directives, or action outcome..."
                    className="w-full rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => submitFinding(id)}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Log Findings"}
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
