import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "../services/api";
import { CaseReport, CaseStatus, User } from "../types";
import { Language, t } from "../i18n";

interface WhistleblowerDashboardProps {
  user: User;
  language: Language;
  onCreateReport: () => void;
  onOpenReports: () => void;
}

export const WhistleblowerDashboard: React.FC<WhistleblowerDashboardProps> = ({
  user,
  language,
  onCreateReport,
  onOpenReports,
}) => {
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);
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
          }));
          setCases(mappedCases);
        }
      } catch (error) {
        console.error("Failed to load whistleblower dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    loadCases();
  }, [user.id]);

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
    const highPriority = cases.filter(
      (item) => item.priority === "HIGH" || item.priority === "CRITICAL",
    ).length;

    return { total, active, successful, closed, highPriority };
  }, [cases]);

  const recentCases = useMemo(
    () =>
      [...cases]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 5),
    [cases],
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
            <button
              onClick={() => { toast.success("Loading your reports..."); onOpenReports(); }}
              className="px-5 py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 font-bold text-sm"
            >
              {t(language, "myReports")}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Total Reports
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
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-5">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            High Priority
          </p>
          <p className="text-3xl font-black mt-2 text-rose-500">
            {loading ? "..." : stats.highPriority}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Recent Case Activity
            </h3>
            <button
              onClick={onOpenReports}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
            >
              View all
            </button>
          </div>

          {recentCases.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400 font-medium mb-4">
                No reports yet. Start by submitting your first case.
              </p>
              <button
                onClick={onCreateReport}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-sm"
              >
                {t(language, "reportCase")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCases.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {item.id}
                    </p>
                    <span className={`text-xs font-bold uppercase ${item.status === "SUCCESSFUL" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}>
                      {item.status === "SUCCESSFUL" ? "✓ Successful" : item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                    {item.description}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(item.timestamp).toLocaleDateString()} •{" "}
                    {item.institution}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-6 space-y-4">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Whistleblower Quick Guide
          </h3>
          <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              1. File complete evidence in your report.
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              2. Save your tracking code for follow-up.
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              3. Monitor updates in My Reports.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
