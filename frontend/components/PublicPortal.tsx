import React, { useState } from "react";
import { apiClient } from "../services/api";
import { User } from "../types";
import { Language, t } from "../i18n";

interface PublicPortalProps {
  onLogin: (user: User) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  themeMode: "system" | "light" | "dark";
  onThemeModeChange: (themeMode: "system" | "light" | "dark") => void;
}

type PortalTab = "signin" | "anonymous" | "tracking";

export const PublicPortal: React.FC<PublicPortalProps> = ({
  onLogin,
  language,
  onLanguageChange,
  themeMode,
  onThemeModeChange,
}) => {
  const [tab, setTab] = useState<PortalTab>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [formData, setFormData] = useState({
    type: "Bribery",
    institution: "",
    location: "",
    description: "",
    priority: "MEDIUM",
  });
  const [submitted, setSubmitted] = useState<any | null>(null);

  const [trackingCode, setTrackingCode] = useState("");
  const [trackedCase, setTrackedCase] = useState<any | null>(null);

  const resetMessages = () => {
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    try {
      const { user } = await apiClient.login(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.description.trim().length < 20) {
      setError("Description must be at least 20 characters.");
      return;
    }

    setLoading(true);
    resetMessages();

    try {
      const response = await apiClient.createAnonymousReport(formData);
      if (!response.success) {
        throw new Error(response.message || "Failed to submit report");
      }
      setSubmitted(response.data);
      setFormData({
        type: "Bribery",
        institution: "",
        location: "",
        description: "",
        priority: "MEDIUM",
      });
    } catch (err: any) {
      setError(err.message || "Failed to submit anonymous report");
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCode.trim()) return;

    setLoading(true);
    resetMessages();

    try {
      const response = await apiClient.trackCase(trackingCode.trim());
      if (!response.success) {
        throw new Error(response.message || "Case not found");
      }
      setTrackedCase(response.data);
    } catch (err: any) {
      setTrackedCase(null);
      setError(err.message || "Unable to track this case");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#04060b] dark:to-[#0a0f1a] text-slate-900 dark:text-slate-200 flex flex-col items-center justify-center px-4 py-8">
      {/* Settings Bar */}
      <div className="absolute top-6 right-6 flex gap-2">
        <select
          value={themeMode}
          onChange={(e) =>
            onThemeModeChange(e.target.value as "system" | "light" | "dark")
          }
          className="px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
        >
          <option value="system">{t(language, "system")}</option>
          <option value="light">{t(language, "light")}</option>
          <option value="dark">{t(language, "dark")}</option>
        </select>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
          className="px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
        >
          <option value="en">English</option>
          <option value="sn">Shona</option>
          <option value="nd">Ndebele</option>
          <option value="to">Tonga</option>
        </select>
      </div>

      {/* Logo & Branding */}
      <div className="mb-12 text-center max-w-xl">
        <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg">
          Z
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-emerald-600 to-indigo-600 dark:from-emerald-400 dark:to-indigo-400 bg-clip-text text-transparent">
          ZACC Portal
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
          Secure reporting platform for integrity concerns. Anonymous,
          protected, and monitored.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl rounded-4xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] shadow-2xl overflow-hidden">
        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-0 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
          {[
            { id: "signin", label: t(language, "signIn"), icon: "🔐" },
            {
              id: "anonymous",
              label: t(language, "anonymousReport"),
              icon: "📝",
            },
            { id: "tracking", label: t(language, "trackCase"), icon: "🛰️" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id as PortalTab);
                setError(null);
              }}
              className={`px-4 py-4 font-bold text-sm uppercase tracking-wider transition-all relative ${
                tab === item.id
                  ? "text-emerald-600 dark:text-emerald-400 bg-white dark:bg-white/5"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <span className="text-base mb-1 block">{item.icon}</span>
              {item.label}
              {tab === item.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-5 py-4 text-rose-700 dark:text-rose-300 text-sm font-medium animate-fade-in">
              <p className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </p>
            </div>
          )}

          {tab === "signin" && (
            <form onSubmit={handleLogin} className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-bold py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:shadow-none"
              >
                {loading ? "Authenticating..." : t(language, "signIn")}
              </button>
            </form>
          )}

          {tab === "anonymous" && (
            <form
              onSubmit={handleAnonymousSubmit}
              className="space-y-6 animate-fade-in"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                    Type of Corruption
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium"
                  >
                    <option>Bribery</option>
                    <option>Procurement Fraud</option>
                    <option>Abuse of Office</option>
                    <option>Embezzlement</option>
                    <option>Nepotism</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                  Affected Institution
                </label>
                <input
                  type="text"
                  value={formData.institution}
                  onChange={(e) =>
                    setFormData({ ...formData, institution: e.target.value })
                  }
                  placeholder="Ministry, department, or organization"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="District or province"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                  Detailed Description
                </label>
                <textarea
                  rows={6}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Provide as much detail as possible. Include dates, names (if known), amounts, and any evidence or witnesses..."
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium leading-relaxed resize-none"
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  Minimum 20 characters • {formData.description.length}{" "}
                  characters
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-bold py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:shadow-none"
              >
                {loading ? "Submitting..." : t(language, "submitAnonymous")}
              </button>

              {submitted && (
                <div className="rounded-3xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-6 animate-fade-in">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">✓</div>
                    <div className="flex-1">
                      <p className="font-black text-emerald-700 dark:text-emerald-300 mb-2 text-lg">
                        Report Submitted Successfully
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
                        Your anonymous report has been securely logged.
                      </p>
                      <div className="bg-white dark:bg-black/30 rounded-2xl p-4 mb-4 border border-emerald-200 dark:border-emerald-500/20">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Tracking Code
                        </p>
                        <p className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-lg tracking-tight">
                          {submitted.reference_code}
                        </p>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium leading-relaxed">
                        Save this code to track your case. Investigators will
                        review within 48-72 hours.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}

          {tab === "tracking" && (
            <div className="space-y-6 animate-fade-in">
              <form
                onSubmit={handleTrack}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                    Enter your tracking code
                  </label>
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="e.g., ZCC-2024-001-ABC123"
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium uppercase tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="sm:mt-7 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-bold px-6 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:shadow-none whitespace-nowrap"
                >
                  {loading ? "Searching..." : "Track"}
                </button>
              </form>

              {trackedCase && (
                <div className="space-y-5 animate-fade-in">
                  {/* Case Header */}
                  <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/2 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Case ID
                        </p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                          {trackedCase.case_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Current Status
                        </p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 uppercase">
                          {trackedCase.status.replace("_", " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Priority
                        </p>
                        <p
                          className={`text-lg font-black uppercase ${
                            trackedCase.priority === "CRITICAL"
                              ? "text-rose-600 dark:text-rose-400"
                              : trackedCase.priority === "HIGH"
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {trackedCase.priority}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stage Evaluations */}
                  {trackedCase.stage_evaluations &&
                  trackedCase.stage_evaluations.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                        Investigation Progress
                      </p>
                      {trackedCase.stage_evaluations.map(
                        (stage: any, idx: number) => (
                          <div
                            key={stage.id}
                            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all"
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {idx + 1}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white mb-2">
                                  {stage.stage}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                                  {stage.investigator_notes || "No notes yet"}
                                </p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Score
                                  </span>
                                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {stage.final_score || "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center">
                      <p className="text-slate-600 dark:text-slate-400 font-medium">
                        Investigation stages will be displayed here as your case
                        progresses.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Message */}
      <div className="mt-12 text-center max-w-xl">
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-widest">
          🔒 End-to-end encrypted • Anonymity guaranteed • Zero-knowledge
          architecture
        </p>
      </div>
    </div>
  );
};
