import React, { useState, useEffect } from "react";
import { apiClient } from "../services/api";
import { CaseReport, CaseStatus } from "../types";

export const InvestigatorView: React.FC = () => {
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CaseStatus | "ALL">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalReport, setModalReport] = useState<any | null>(null);
  const [actionComment, setActionComment] = useState<string>("");
  const [actionProcessing, setActionProcessing] = useState(false);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        // In a real app, this would be apiClient.getReports()
        // For now, we'll try to get reports from the backend
        const response = await apiClient.getReports();
        if (response && response.success && Array.isArray(response.data)) {
          setCases(response.data);
        } else {
          // Fallback to local storage if API fails or is not seeded
          const saved = JSON.parse(localStorage.getItem("zacc_cases") || "[]");
          setCases(saved);
        }
      } catch (err) {
        console.error("Failed to fetch cases:", err);
        const saved = JSON.parse(localStorage.getItem("zacc_cases") || "[]");
        setCases(saved);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const filteredCases =
    filter === "ALL" ? cases : cases.filter((c) => c.status === filter);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Investigation Pipeline
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Review reported cases and manage investigation status
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", ...Object.values(CaseStatus)] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                filter === s
                  ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20"
                  : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20"
              }`}
            >
              {s === "ALL" ? "All Cases" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">
            Total Cases
          </p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">
            {cases.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">
            Under Review
          </p>
          <p className="text-3xl font-black text-blue-500">
            {cases.filter((c) => c.status === CaseStatus.UNDER_REVIEW).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">
            Investigating
          </p>
          <p className="text-3xl font-black text-amber-500">
            {cases.filter((c) => c.status === CaseStatus.INVESTIGATING).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">
            High Priority
          </p>
          <p className="text-3xl font-black text-rose-500">
            {
              cases.filter(
                (c) => c.priority === "HIGH" || c.priority === "CRITICAL",
              ).length
            }
          </p>
        </div>
      </div>

      {/* Cases Grid */}
      <div>
        {loading ? (
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 p-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Loading investigations...
              </p>
            </div>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/10 p-16 text-center">
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              No cases found in this category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredCases.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-6 hover:border-emerald-400 dark:hover:border-emerald-500/30 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <code className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">
                      {c.referenceCode || String(c.id).slice(0, 8)}
                    </code>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                      {c.type}
                    </h3>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      c.status === CaseStatus.SUBMITTED
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                        : c.status === CaseStatus.UNDER_REVIEW
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20"
                          : c.status === CaseStatus.INVESTIGATING
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                            : c.status === CaseStatus.REFERRED
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                              : c.status === CaseStatus.CLOSED
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                    }`}
                  >
                    {c.status.replace("_", " ")}
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                  {c.description}
                </p>

                <div className="space-y-4 mb-6 pb-6 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                      Institution
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {c.institution}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                      Priority
                    </span>
                    <span
                      className={`text-sm font-bold uppercase ${
                        c.priority === "CRITICAL"
                          ? "text-rose-600 dark:text-rose-400"
                          : c.priority === "HIGH"
                            ? "text-orange-600 dark:text-orange-400"
                            : c.priority === "MEDIUM"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {c.priority}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Risk Score
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {c.riskScore}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.riskScore > 75
                            ? "bg-rose-500"
                            : c.riskScore > 40
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${c.riskScore}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      setModalLoading(true);
                      setModalOpen(true);
                      const idToFetch = c.id || c.case_id || c.referenceCode;
                      const response = await apiClient.get(
                        `/reports/${idToFetch}`,
                      );
                      if (response && response.success) {
                        setModalReport(response.data);
                      } else {
                        setModalReport({
                          error: response?.message || "Failed to load report",
                        });
                      }
                    } catch (err: any) {
                      setModalReport({
                        error: err.message || "Failed to load report",
                      });
                    } finally {
                      setModalLoading(false);
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm uppercase tracking-wider transition-all"
                >
                  Review Dossier
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white dark:bg-[#080c18] border border-slate-200 dark:border-white/10 overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-[#080c18] border-b border-slate-200 dark:border-white/10 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Case Dossier
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setModalReport(null);
                  setActionComment("");
                }}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              {modalLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      Loading dossier...
                    </p>
                  </div>
                </div>
              ) : modalReport?.error ? (
                <div className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-300 dark:border-rose-500/20">
                  <p className="text-rose-700 dark:text-rose-300 font-medium">
                    {modalReport.error}
                  </p>
                </div>
              ) : modalReport ? (
                <div className="space-y-8">
                  {/* Header Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Reference Code
                      </p>
                      <code className="text-lg font-black text-emerald-600 dark:text-emerald-400 break-all">
                        {modalReport.reference_code ||
                          modalReport.case_id ||
                          modalReport.id}
                      </code>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Current Status
                      </p>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase">
                        {modalReport.status}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Priority
                      </p>
                      <p
                        className={`text-lg font-black uppercase ${
                          modalReport.priority === "CRITICAL"
                            ? "text-rose-600 dark:text-rose-400"
                            : modalReport.priority === "HIGH"
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {modalReport.priority}
                      </p>
                    </div>
                  </div>

                  {/* Case Details */}
                  <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 p-6 bg-slate-50 dark:bg-white/5">
                    <div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Case Type
                      </p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {modalReport.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Institution
                      </p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {(modalReport.decrypted_data &&
                          modalReport.decrypted_data.institution) ||
                          modalReport.institution}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Location
                      </p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {(modalReport.decrypted_data &&
                          modalReport.decrypted_data.location) ||
                          modalReport.location ||
                          "N/A"}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Description
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        {(modalReport.decrypted_data &&
                          modalReport.decrypted_data.description) ||
                          modalReport.description ||
                          "No description available"}
                      </p>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {modalReport.ai_summary && (
                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 p-6">
                      <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-3">
                        AI Analysis
                      </p>
                      <pre className="text-sm text-indigo-900 dark:text-indigo-100 whitespace-pre-wrap font-mono leading-relaxed">
                        {JSON.stringify(modalReport.ai_summary, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Action Section */}
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-6 bg-slate-50 dark:bg-white/5">
                    <p className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                      Update Investigation Status
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                          Investigator Notes
                        </label>
                        <textarea
                          value={actionComment}
                          onChange={(e) => setActionComment(e.target.value)}
                          placeholder="Add findings, observations, or actions taken..."
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
                          rows={4}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                          Next Status
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            "UNDER_REVIEW",
                            "INVESTIGATING",
                            "REFERRED",
                            "CLOSED",
                          ].map((s) => (
                            <button
                              key={s}
                              disabled={actionProcessing}
                              onClick={async () => {
                                if (!modalReport) return;
                                try {
                                  setActionProcessing(true);
                                  const idToUpdate =
                                    modalReport.id || modalReport.case_id;
                                  const payload = {
                                    stage: s,
                                    investigator_notes:
                                      actionComment || `Updated to ${s}`,
                                  };
                                  const resp =
                                    await apiClient.createStageEvaluation(
                                      idToUpdate,
                                      payload,
                                    );
                                  if (resp && resp.success) {
                                    setModalReport((prev: any) => ({
                                      ...prev,
                                      status: s,
                                      risk_score:
                                        resp.data?.final_score ??
                                        prev?.risk_score,
                                    }));
                                    setCases((prev) =>
                                      prev.map((c) =>
                                        c.id === idToUpdate ||
                                        c.case_id === idToUpdate
                                          ? {
                                              ...c,
                                              status: s,
                                              riskScore:
                                                resp.data?.final_score ??
                                                c.riskScore,
                                            }
                                          : c,
                                      ),
                                    );
                                    setActionComment("");
                                  } else {
                                    alert(
                                      resp?.message ||
                                        "Failed to create stage evaluation",
                                    );
                                  }
                                } catch (err: any) {
                                  alert(
                                    err.message ||
                                      "Failed to create stage evaluation",
                                  );
                                } finally {
                                  setActionProcessing(false);
                                }
                              }}
                              className={`px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                                actionProcessing
                                  ? "opacity-50 cursor-not-allowed"
                                  : s === "UNDER_REVIEW"
                                    ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
                                    : s === "INVESTIGATING"
                                      ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                                      : s === "REFERRED"
                                        ? "bg-purple-500 hover:bg-purple-600 text-white border-purple-600"
                                        : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600"
                              }`}
                            >
                              {s.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-600 dark:text-slate-400">
                    No report loaded.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
