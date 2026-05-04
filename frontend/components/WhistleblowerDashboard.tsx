import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "../services/api";
import { CaseReport, CaseStatus, User } from "../types";
import { Language, t } from "../i18n";
import BlockchainVerification from "./BlockchainVerification";

interface WhistleblowerDashboardProps {
  user: User;
  language: Language;
  onCreateReport: () => void;
}

const stagesDefault = [
  { key: CaseStatus.SUBMITTED, label: "Submitted", icon: "📥" },
  { key: CaseStatus.UNDER_REVIEW, label: "Reviewing", icon: "🔎" },
  { key: CaseStatus.INVESTIGATING, label: "Investigation", icon: "🔍" },
  { key: CaseStatus.REFERRED, label: "Other Authorities", icon: "⚖️" },
  { key: CaseStatus.CLOSED, label: "Closed", icon: "✅" },
];

const stagesSuccessful = [
  { key: CaseStatus.SUBMITTED, label: "Submitted", icon: "📥" },
  { key: CaseStatus.UNDER_REVIEW, label: "Reviewing", icon: "🔎" },
  { key: CaseStatus.INVESTIGATING, label: "Investigation", icon: "🔍" },
  { key: CaseStatus.SUCCESSFUL, label: "✓ Successful", icon: "🏆" },
];

const getStagesForStatus = (status: CaseStatus) =>
  status === CaseStatus.SUCCESSFUL ? stagesSuccessful : stagesDefault;

const getStatusIndex = (status: CaseStatus, stageList: typeof stagesDefault) => {
  if (status === CaseStatus.DISPUTED) return 2;
  return stageList.findIndex((s) => s.key === status);
};

export const WhistleblowerDashboard: React.FC<WhistleblowerDashboardProps> = ({
  user,
  language,
  onCreateReport,
}) => {
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCases = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await apiClient.getReports();
      if (response.success && Array.isArray(response.data)) {
        const mappedCases = response.data.map((report: any) => ({
          id: report.case_id,
          timestamp: report.created_at,
          type: report.type,
          description: report.description,
          location: report.location,
          institution: report.institution,
          status: report.status,
          riskScore: report.risk_score,
          priority: report.priority,
          reporterId: report.user_id,
          referenceCode: report.reference_code,
          disputeReason: report.dispute_reason,
          lastUpdated: report.last_updated,
          blockchain_tx_hash: report.blockchain_tx_hash,
          blockchain_block_number: report.blockchain_block_number,
          aiCategory:
            report.ai_summary?.category ||
            report.ai_summary?.type_inference?.inferred_type ||
            report.type,
          aiConfidence:
            Number(
              report.ai_summary?.confidence ??
                report.ai_summary?.type_inference?.confidence ??
                0,
            ) || 0,
        }));
        setCases(mappedCases);
      }
    } catch (error) {
      if (!silent) {
        console.error("Failed to load whistleblower dashboard data", error);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases, user.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCases(true);
      }
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [loadCases]);

  const stats = useMemo(() => {
    const total = cases.length;
    const active = cases.filter(
      (item) => item.status !== CaseStatus.CLOSED && item.status !== CaseStatus.SUCCESSFUL,
    ).length;
    const successful = cases.filter(
      (item) => item.status === CaseStatus.SUCCESSFUL,
    ).length;
    const closed = cases.filter(
      (item) => item.status === CaseStatus.CLOSED,
    ).length;

    return { total, active, successful, closed };
  }, [cases]);

  const recentCases = useMemo(
    () =>
      [...cases]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [cases],
  );

  const successfulCases = useMemo(
    () => recentCases.filter((item) => item.status === CaseStatus.SUCCESSFUL).slice(0, 4),
    [recentCases],
  );

  const closedCases = useMemo(
    () => recentCases.filter((item) => item.status === CaseStatus.CLOSED).slice(0, 4),
    [recentCases],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-emerald-500 mb-2">
              {t(language, "myDashboard")}
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
              Welcome back, {user.nexusKey}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
              View your reporting activity, track active investigations, and
              quickly file new evidence from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { toast.success("Opening report form..."); onCreateReport(); }}
              className="px-5 py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm"
            >
              {t(language, "reportCase")}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Total Cases
          </p>
          <p className="text-3xl font-black mt-2 text-slate-900 dark:text-white">
            {loading ? "..." : stats.total}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Active Cases
          </p>
          <p className="text-3xl font-black mt-2 text-slate-900 dark:text-white">
            {loading ? "..." : stats.active}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">
            ✓ Successful
          </p>
          <p className="text-3xl font-black mt-2 text-emerald-500">
            {loading ? "..." : stats.successful}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Closed Cases
          </p>
          <p className="text-3xl font-black mt-2 text-slate-900 dark:text-white">
            {loading ? "..." : stats.closed}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider mb-3">
            Successful Reports
          </p>
          {successfulCases.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No successful reports yet.</p>
          ) : (
            <div className="space-y-2">
              {successfulCases.map((item) => (
                <div key={item.id} className="rounded-xl border border-emerald-400/20 px-3 py-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.id}</p>
                  <p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleDateString()} • {item.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-3">
            Closed Reports
          </p>
          {closedCases.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No closed reports yet.</p>
          ) : (
            <div className="space-y-2">
              {closedCases.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.id}</p>
                  <p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleDateString()} • {item.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          Case Progress
        </h3>

        {recentCases.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 font-medium mb-4">
              No cases yet. Start by submitting your first report.
            </p>
            <button
              onClick={onCreateReport}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-sm"
            >
              {t(language, "reportCase")}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {recentCases.map((item) => {
              const caseStages = getStagesForStatus(item.status as CaseStatus);
              const statusIdx = getStatusIndex(item.status as CaseStatus, caseStages);
              const isDisputed = item.status === CaseStatus.DISPUTED;
              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-6 bg-white dark:bg-[#080c18] ${
                    isDisputed
                      ? "border-rose-500/30"
                      : "border-slate-200 dark:border-white/10"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.id}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.institution} • {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold uppercase ${
                        item.status === "SUCCESSFUL"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isDisputed
                            ? "text-rose-500"
                            : "text-slate-600 dark:text-slate-300"
                      }`}>
                        {item.status === "SUCCESSFUL" ? "✓ Successful" : item.status.replace("_", " ")}
                      </span>
                      {item.referenceCode && (
                        <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                          {item.referenceCode}
                        </p>
                      )}
                      <p className="text-[10px] font-bold text-violet-600 dark:text-violet-300 mt-1">
                        AI: {item.aiCategory || item.type}
                        {item.aiConfidence ? ` (${item.aiConfidence}%)` : ""}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Progress bar */}
                  <div className="relative flex justify-between items-center px-2">
                    <div className="absolute left-6 right-6 h-0.5 bg-slate-200 dark:bg-white/5 top-1/2 -translate-y-1/2 z-0 rounded-full" />
                    <div
                      className={`absolute left-6 h-1 top-1/2 -translate-y-1/2 z-0 transition-all duration-700 ease-in-out rounded-full ${
                        isDisputed
                          ? "bg-rose-500 shadow-rose-500/30"
                          : "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      }`}
                      style={{
                        width: `calc(${(statusIdx / (caseStages.length - 1)) * 100}% - 12px)`,
                      }}
                    />

                    {caseStages.map((s, idx) => {
                      const isActive = idx <= statusIdx;
                      const isCurrent =
                        s.key === item.status ||
                        (isDisputed && s.key === CaseStatus.INVESTIGATING);
                      return (
                        <div key={s.key} className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-500 ${
                              isCurrent
                                ? isDisputed
                                  ? "bg-rose-500 text-white scale-110 ring-4 ring-rose-500/10"
                                  : "bg-emerald-500 text-white scale-110 ring-4 ring-emerald-500/10"
                                : isActive
                                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
                                  : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-700"
                            }`}
                          >
                            {isDisputed && s.key === CaseStatus.INVESTIGATING ? "⚠️" : s.icon}
                          </div>
                          <p
                            className={`text-[9px] font-bold uppercase mt-3 tracking-widest text-center transition-colors ${
                              isCurrent
                                ? "text-slate-900 dark:text-white"
                                : isActive
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-slate-400 dark:text-slate-700"
                            }`}
                          >
                            {s.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <BlockchainVerification reportId={item.id} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
