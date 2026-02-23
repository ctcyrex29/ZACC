import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { ReportForm } from "./components/ReportForm";
import { InvestigatorView } from "./components/InvestigatorView";
import { CaseTracking } from "./components/CaseTracking";
import { UserManagement } from "./components/UserManagement";
import { Login } from "./components/Login";
import { User, UserRole } from "./types";

export type View =
  | "dashboard"
  | "report"
  | "hub"
  | "chat"
  | "media"
  | "investigator"
  | "tracking"
  | "users";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>("dashboard");

  useEffect(() => {
    const savedUser = localStorage.getItem("nexus_user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setCurrentView(
        parsed.role === UserRole.INVESTIGATOR || parsed.role === UserRole.ADMIN
          ? "investigator"
          : "tracking",
      );
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem("nexus_user", JSON.stringify(u));
    setCurrentView(
      u.role === UserRole.INVESTIGATOR || u.role === UserRole.ADMIN
        ? "investigator"
        : "tracking",
    );
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("nexus_user");
    setCurrentView("dashboard");
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard />;
      case "report":
        return (
          <ReportForm
            user={user}
            onSuccess={() => setCurrentView("tracking")}
          />
        );
      case "investigator":
        return <InvestigatorView />;
      case "tracking":
        return (
          <CaseTracking
            user={user}
            onCreateReport={() => setCurrentView("report")}
          />
        );
      case "users":
        return <UserManagement />;
      default:
        return <Dashboard />;
    }
  };

  const getTitle = (view: View) => {
    switch (view) {
      case "dashboard":
        return "System Overview";
      case "report":
        return "Report Case";
      case "investigator":
        return "Control Center";
      case "tracking":
        return "My Reports";
      case "users":
        return "User Management";
      default:
        return "Nexus";
    }
  };

  return (
    <div className="flex h-screen bg-[#04060b] font-sans text-slate-300 overflow-hidden">
      <Sidebar
        user={user}
        currentView={currentView}
        setView={setCurrentView}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-16 scroll-smooth">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
            <div className="relative">
              <div className="absolute top-0 left-0 w-20 h-2 bg-nexus-emerald/30 mb-8 rounded-full"></div>
              <h1 className="text-5xl font-black text-white tracking-tighter mb-3 pt-6 uppercase">
                {getTitle(currentView)}
              </h1>
            </div>

            <div className="flex items-center gap-6 bg-[#080c18] px-8 py-5 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl group hover:border-nexus-emerald/20 transition-all">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Session Identity
                </p>
                <p className="text-sm font-black text-white leading-none tracking-widest flex items-center gap-2">
                  {user.nexusKey}
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nexus-emerald/20 to-emerald-900/10 text-nexus-emerald flex items-center justify-center font-black border border-nexus-emerald/10 shadow-lg group-hover:scale-110 transition-transform">
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
        .stealth-blur {
          background: black !important;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
