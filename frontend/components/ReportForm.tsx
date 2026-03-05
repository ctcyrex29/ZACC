import React, { useState } from "react";
import { analyzeCase } from "../services/gemini";
import { apiClient } from "../services/api";
import { CorruptionType, User, CaseStatus, CaseReport } from "../types";

interface ReportFormProps {
  user: User;
  onSuccess: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({ user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: CorruptionType.BRIBERY,
    institution: "",
    location: "",
    description: "",
  });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [submittedReport, setSubmittedReport] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.description.trim().length < 20) {
      setError("Description must be at least 20 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get AI analysis first
      const analysis = await analyzeCase(formData.description);

      // Submit to backend API
      const response = await apiClient.createReport({
        type: analysis.category || formData.type,
        institution: formData.institution,
        location: formData.location,
        description: formData.description,
        priority: analysis.priority || "MEDIUM",
        risk_score: analysis.riskScore || 50,
      });

      if (response.success) {
        setAiAnalysis(analysis);
        setSubmittedReport(response.data);
      } else {
        throw new Error(response.message || "Failed to submit report");
      }

      setLoading(false);
    } catch (err: any) {
      console.error("Error submitting report:", err);
      setError(err.message || "Failed to submit report. Please try again.");
      setLoading(false);
    }
  };

  if (aiAnalysis && submittedReport) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Success Card */}
        <div className="rounded-3xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 text-5xl">
              ✓
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-emerald-900 dark:text-emerald-100 mb-3">
              Report Submitted Successfully
            </h2>
            <p className="text-emerald-800 dark:text-emerald-200 max-w-md mx-auto leading-relaxed">
              Your case has been securely logged and is now in the investigation
              queue.
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-white/30 dark:bg-white/5 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Category
              </p>
              <p className="text-sm font-black text-emerald-900 dark:text-white">
                {submittedReport.type}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Priority
              </p>
              <p
                className={`text-sm font-black uppercase ${
                  submittedReport.priority === "CRITICAL"
                    ? "text-rose-600 dark:text-rose-400"
                    : submittedReport.priority === "HIGH"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {submittedReport.priority}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Risk Score
              </p>
              <p className="text-sm font-black text-emerald-900 dark:text-white">
                {submittedReport.risk_score}%
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Status
              </p>
              <p className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase">
                Submitted
              </p>
            </div>
          </div>

          {/* Tracking Code */}
          <div className="bg-white dark:bg-black/20 rounded-2xl p-6 mb-8 border border-emerald-200 dark:border-emerald-500/20">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-3">
              Your Tracking Code
            </p>
            <div className="flex items-center justify-between gap-4">
              <code className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {submittedReport.reference_code}
              </code>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(submittedReport.reference_code)
                }
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-all"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-white/20 dark:bg-white/5 rounded-2xl p-6 mb-8 border border-emerald-200/30 dark:border-white/10">
            <h3 className="font-bold text-emerald-900 dark:text-white mb-4">
              What Happens Next
            </h3>
            <ol className="space-y-3 text-sm text-emerald-800 dark:text-emerald-100">
              <li className="flex gap-3">
                <span className="font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  1.
                </span>
                <span>
                  Our team reviews your submission and conducts an initial
                  assessment.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  2.
                </span>
                <span>
                  You can track progress using your tracking code in the "Track
                  Case" section.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  3.
                </span>
                <span>
                  Investigators will update status within 48-72 hours.
                </span>
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setAiAnalysis(null);
                setSubmittedReport(null);
                setFormData({
                  type: CorruptionType.BRIBERY,
                  institution: "",
                  location: "",
                  description: "",
                });
              }}
              className="flex-1 px-6 py-4 rounded-xl bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 text-emerald-900 dark:text-white font-bold text-sm uppercase tracking-wider transition-all border border-emerald-200 dark:border-white/10"
            >
              File Another Report
            </button>
            <button
              onClick={onSuccess}
              className="flex-1 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider transition-all"
            >
              View My Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-8 md:p-10">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
            File a Report
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            Provide detailed information about the integrity concern. All
            submissions are encrypted and protected.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 p-5 rounded-2xl border border-rose-300 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 animate-fade-in">
            <p className="text-rose-700 dark:text-rose-300 text-sm font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Category and Institution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                Type of Corruption
              </label>
              <select
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as CorruptionType,
                  })
                }
              >
                {Object.values(CorruptionType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                Affected Institution
              </label>
              <input
                type="text"
                placeholder="Ministry, department, or company"
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
                value={formData.institution}
                onChange={(e) =>
                  setFormData({ ...formData, institution: e.target.value })
                }
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
              Detailed Description
            </label>
            <textarea
              rows={6}
              placeholder="Describe what happened in detail. Include dates, names (if known), amounts, and any witnesses or evidence..."
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 font-medium leading-relaxed focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all resize-none"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
            <p
              className={`text-xs font-medium ml-1 ${
                formData.description.length < 20
                  ? "text-slate-500 dark:text-slate-600"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {formData.description.length} characters (minimum 20 required)
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
              Location (District/Province)
            </label>
            <input
              type="text"
              placeholder="e.g., Harare, Bulawayo, Chitungwiza"
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
          </div>

          {/* Security Info */}
          <div className="p-5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-700 dark:text-slate-400 font-medium flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <span>
                Your report is securely encrypted. Your identity is protected
                throughout the process.
              </span>
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || formData.description.trim().length < 20}
            className={`w-full rounded-2xl font-bold py-4 text-sm uppercase tracking-widest transition-all ${
              loading || formData.description.trim().length < 20
                ? "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : (
              "Submit Secure Report"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
