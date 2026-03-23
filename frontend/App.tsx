import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { ReportForm } from "./components/ReportForm";
import { InvestigatorView } from "./components/InvestigatorView";
import { CaseTracking } from "./components/CaseTracking";
import { UserManagement } from "./components/UserManagement";
import { User, UserRole } from "./types";
import { PublicPortal } from "./components/PublicPortal";
import { Language, t } from "./i18n";
import { WhistleblowerDashboard } from "./components/WhistleblowerDashboard";
import { ChatBot } from "./components/ChatBot";
import { ReportGeneration } from "./components/ReportGeneration";
import { CorruptionHotspots } from "./components/CorruptionHotspots";

type ThemeMode = "system" | "light" | "dark";

export type View =
  | "dashboard"
  | "report"
  | "hub"
  | "chat"
  | "media"
  | "investigator"
  | "tracking"
  | "users"
  | "reports"
  | "hotspots";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const savedUser = localStorage.getItem("nexus_user");
    const savedTheme = (localStorage.getItem("zacc_theme_mode") ||
      "system") as ThemeMode;
    const savedLanguage = (localStorage.getItem("zacc_language") ||
      "en") as Language;

    setThemeMode(savedTheme);
    setLanguage(savedLanguage);

    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      // Whistleblowers no longer use auth sessions — clear any residual saved sessions
      if (parsed.role === UserRole.WHISTLEBLOWER) {
        localStorage.removeItem("nexus_user");
        localStorage.removeItem("nexus_token");
        return;
      }
      setUser(parsed);
      setCurrentView(
        parsed.role === UserRole.INVESTIGATOR || parsed.role === UserRole.ADMIN
          ? "investigator"
          : "dashboard",
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("zacc_theme_mode", themeMode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark =
      themeMode === "dark" || (themeMode === "system" && media.matches);

    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("bg-white", !isDark);
    document.body.classList.toggle("bg-[#04060b]", isDark);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem("zacc_language", language);
  }, [language]);

  const handleLogin = (u: User) => {
    if (u.role === UserRole.WHISTLEBLOWER) return; // blocked at PublicPortal level
    setUser(u);
    localStorage.setItem("nexus_user", JSON.stringify(u));
    setCurrentView("investigator");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("nexus_user");
    setCurrentView("dashboard");
  };

  if (!user) {
    return (
      <>
        <PublicPortal
          onLogin={handleLogin}
          language={language}
          onLanguageChange={setLanguage}
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
        />
        <ChatBot />
      </>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        if (user.role === UserRole.WHISTLEBLOWER) {
          return (
            <WhistleblowerDashboard
              user={user}
              language={language}
              onCreateReport={() => setCurrentView("report")}
              onOpenReports={() => setCurrentView("tracking")}
            />
          );
        }
        return <Dashboard />;
      case "report":
        return (
          <ReportForm
            user={user}
            language={language}
            onSuccess={() => setCurrentView("tracking")}
          />
        );
      case "investigator":
        return <InvestigatorView user={user} />;
      case "tracking":
        return (
          <CaseTracking
            user={user}
            onCreateReport={() => setCurrentView("report")}
          />
        );
      case "users":
        return <UserManagement />;
      case "reports":
        return <ReportGeneration language={language} />;
      case "hotspots":
        return <CorruptionHotspots />;
      default:
        return <Dashboard />;
    }
  };

  const getTitle = (view: View) => {
    switch (view) {
      case "dashboard":
        return user.role === UserRole.WHISTLEBLOWER
          ? t(language, "myDashboard")
          : t(language, "systemOverview");
      case "report":
        return t(language, "reportCase");
      case "investigator":
        return t(language, "controlCenter");
      case "tracking":
        return t(language, "myReports");
      case "users":
        return t(language, "userManagement");
      case "reports":
        return t(language, "reportGeneration");
      case "hotspots":
        return t(language, "corruptionHotspots");
      default:
        return t(language, "appTitle");
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 dark:bg-[#04060b] dark:text-slate-300 overflow-hidden">
      <Sidebar
        user={user}
        currentView={currentView}
        setView={setCurrentView}
        onLogout={handleLogout}
        language={language}
        onLanguageChange={setLanguage}
      />

      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 scroll-smooth">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div className="relative">
              <div className="absolute top-0 left-0 w-20 h-2 bg-nexus-emerald/40 mb-8 rounded-full"></div>
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-2 pt-4 uppercase">
                {getTitle(currentView)}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#080c18] px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10">
              <select
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-semibold"
              >
                <option value="system">{t(language, "system")}</option>
                <option value="light">{t(language, "light")}</option>
                <option value="dark">{t(language, "dark")}</option>
              </select>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-semibold"
              >
                <option value="en">English</option>
                <option value="sn">Shona</option>
                <option value="nd">Ndebele</option>
                <option value="to">Tonga</option>
              </select>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  {t(language, "sessionIdentity")}
                </p>
                <p className="text-xs font-black text-slate-900 dark:text-white leading-none tracking-widest flex items-center gap-2">
                  {user.nexusKey}
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center font-black border border-emerald-400/30">
                {user.nexusKey.charAt(0)}
              </div>
            </div>
          </header>

          <div
            className="animate-fade-in transition-all duration-500"
            id="content-container"
          >
            {renderView()}
          </div>
        </div>
      </main>

      <style>{`
        .stealth-blur #content-container {
          filter: blur(25px);
          opacity: 0.2;
          pointer-events: none;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
