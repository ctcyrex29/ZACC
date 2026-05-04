import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "../services/api";
import { User, UserRole } from "../types";

interface CaseDetailViewProps {
  caseId: string | number;
  user: User;
  onBack: () => void;
}

const STAGE_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["INVESTIGATING", "CLOSED"],
  INVESTIGATING: ["REFERRED", "SUCCESSFUL", "CLOSED"],
  REFERRED: ["REFERRED", "SUCCESSFUL", "CLOSED"],
  SUCCESSFUL: ["CLOSED"],
  DISPUTED: ["UNDER_REVIEW", "INVESTIGATING", "REFERRED", "CLOSED"],
  CLOSED: [],
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    INVESTIGATING: "Investigating",
    REFERRED: "Referred",
    SUCCESSFUL: "Successful",
    CLOSED: "Closed",
    DISPUTED: "Disputed",
  };
  return labels[status] || status;
};

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({ caseId, user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [nextStage, setNextStage] = useState("");
  const [notes, setNotes] = useState("");

  const [referralAuthority, setReferralAuthority] = useState("National Prosecuting Authority (NPA)");
  const [referralLegalBasis, setReferralLegalBasis] = useState(
    "Evidence indicates potential criminal conduct requiring prosecution review.",
  );
  const [referralReference, setReferralReference] = useState("");
  const [referralTransmissionDate, setReferralTransmissionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const canTransition = user.role === UserRole.ADMIN || user.role === UserRole.INVESTIGATOR;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportResp, stagesResp] = await Promise.all([
        apiClient.get(`/reports/${encodeURIComponent(String(caseId))}`),
        apiClient.getStageEvaluations(String(caseId)).catch(() => null),
      ]);

      if (!reportResp?.success) {
        throw new Error(reportResp?.message || "Failed to load case detail");
      }

      setReport(reportResp.data);

      const stageRows = Array.isArray(stagesResp?.data) ? stagesResp.data : [];
      setStages(stageRows);

      const options = STAGE_TRANSITIONS[String(reportResp.data?.status || "")] || [];
      setNextStage(options[0] || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load case detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  const allowedNextStages = useMemo(() => {
    if (!report?.status) return [];
    return STAGE_TRANSITIONS[String(report.status)] || [];
  }, [report?.status]);

  const handleDownload = async (attachment: any) => {
    const reportId = report?.case_id || report?.id;
    if (!reportId || !attachment?.id) return;

    try {
      const token = localStorage.getItem("nexus_token");
      const apiRoot = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/?api\/?$/, "");
      const url = `${apiRoot}/api/reports/${encodeURIComponent(String(reportId))}/attachments/${attachment.id}/download`;

      const response = await fetch(url, {
        headers: {
          Accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = attachment.original_name || attachment.file_name || `attachment-${attachment.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      toast.error(err?.message || "Unable to download attachment");
    }
  };

  const submitTransition = async () => {
    if (!nextStage) {
      toast.error("Select a valid next stage");
      return;
    }
    if (notes.trim().length < 10) {
      toast.error("Investigator notes must be at least 10 characters");
      return;
    }

    if (nextStage === "REFERRED") {
      if (!referralAuthority.trim() || !referralLegalBasis.trim() || !referralReference.trim() || !referralTransmissionDate) {
        toast.error("All referral fields are required");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        stage: nextStage,
        investigator_notes: notes,
      };

      if (nextStage === "REFERRED") {
        payload.referral_authority = referralAuthority;
        payload.referral_legal_basis = referralLegalBasis;
        payload.referral_reference = referralReference;
        payload.referral_transmission_date = referralTransmissionDate;
      }

      const response = await apiClient.createStageEvaluation(String(caseId), payload);
      if (!response?.success) {
        throw new Error(response?.message || "Failed to update case stage");
      }

      toast.success("Case stage updated successfully");
      setNotes("");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update case stage");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="zacc-surface p-10 rounded-3xl text-center max-w-4xl mx-auto">
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Loading case flow...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="zacc-surface p-10 rounded-3xl text-center max-w-4xl mx-auto">
        <p className="text-rose-600 dark:text-rose-300 font-semibold mb-4">{error || "Case data unavailable"}</p>
        <button onClick={onBack} className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-sm">
          Back to Investigator View
        </button>
      </div>
    );
  }

  const description = report?.decrypted_data?.description || report?.description || "No description provided.";
  const attachments: any[] = Array.isArray(report?.attachments) ? report.attachments : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="zacc-surface p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider font-bold text-slate-500">Case Flow Workspace</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{report.reference_code || report.case_id || report.id}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{report.type} • {report.institution || "Unknown institution"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase border border-blue-300/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 bg-blue-500/10">
            {statusLabel(report.status)}
          </span>
          <button onClick={onBack} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10 text-sm font-bold">
            Back
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="zacc-surface p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Case Narrative</p>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{description}</p>
          </div>

          <div className="zacc-surface p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">Investigation Timeline</p>
            {stages.length === 0 ? (
              <p className="text-sm text-slate-500">No stage records yet.</p>
            ) : (
              <div className="space-y-3">
                {stages.map((stage, idx) => (
                  <div key={stage.id || idx} className="border border-slate-200 dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-white/5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{statusLabel(stage.stage || "N/A")}</p>
                      <p className="text-[11px] text-slate-500">{new Date(stage.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-1">By: {stage.investigator?.name || "Investigator"} • Score: {stage.final_score ?? "-"}/100</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{stage.investigator_notes || "No notes"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="zacc-surface p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">Evidence Files</p>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-500">No attachments found.</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-2 border border-slate-200 dark:border-white/10 rounded-lg p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{file.original_name || file.file_name}</p>
                      <p className="text-[11px] text-slate-500">{file.mime_type || "file"}</p>
                    </div>
                    <button onClick={() => handleDownload(file)} className="px-2 py-1 rounded-md text-xs font-bold border border-blue-300/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10">
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canTransition && (
            <div className="zacc-surface p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">Stage Transition</p>
              {allowedNextStages.length === 0 ? (
                <p className="text-sm text-slate-500">No valid next stages from current status.</p>
              ) : (
                <>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Next Stage</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                    value={nextStage}
                    onChange={(e) => setNextStage(e.target.value)}
                  >
                    {allowedNextStages.map((stage) => (
                      <option key={stage} value={stage}>{statusLabel(stage)}</option>
                    ))}
                  </select>

                  <label className="mt-3 block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Investigator Notes</label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                    placeholder="Document your stage action and key findings..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />

                  {nextStage === "REFERRED" && (
                    <div className="mt-3 space-y-2">
                      <input
                        className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                        placeholder="Referral authority"
                        value={referralAuthority}
                        onChange={(e) => setReferralAuthority(e.target.value)}
                      />
                      <textarea
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                        placeholder="Legal basis"
                        value={referralLegalBasis}
                        onChange={(e) => setReferralLegalBasis(e.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                        placeholder="Referral reference"
                        value={referralReference}
                        onChange={(e) => setReferralReference(e.target.value)}
                      />
                      <input
                        type="date"
                        className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                        value={referralTransmissionDate}
                        onChange={(e) => setReferralTransmissionDate(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    disabled={saving}
                    onClick={submitTransition}
                    className="mt-3 w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-black text-sm font-black uppercase tracking-wider"
                  >
                    {saving ? "Updating..." : "Apply Stage Update"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseDetailView;
