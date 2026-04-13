import React, { useState } from "react";
import { User, UserRole } from "../types";
import { View } from "../App";
import { Language, t } from "../i18n";

interface SidebarProps {
  user: User;
  currentView: string;
  setView: (view: View) => void;
  onLogout: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  notificationCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  currentView,
  setView,
  onLogout,
  language,
  onLanguageChange,
  notificationCount = 0,
}) => {
  const [stealthActive, setStealthActive] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleStealth = () => {
    setStealthActive(!stealthActive);
    document.documentElement.classList.toggle("stealth-blur");
  };

  const commonItems = [
    {
      id: "dashboard",
      label:
        user.role === UserRole.WHISTLEBLOWER
          ? t(language, "myDashboard")
          : t(language, "systemOverview"),
      icon: "📊",
    },
  ];

  const whistleblowerItems = [
    { id: "report", label: t(language, "reportCase"), icon: "📝" },
    { id: "tracking", label: t(language, "myReports"), icon: "🛰️" },
  ];

  const investigatorItems = [
    { id: "investigator", label: t(language, "controlCenter"), icon: "📂" },
    { id: "reports", label: t(language, "reportGeneration"), icon: "📋" },
    { id: "hotspots", label: t(language, "corruptionHotspots"), icon: "🔥" },
  ];

  const adminItems = [
    { id: "investigator", label: t(language, "controlCenter"), icon: "📂" },
    { id: "reports", label: t(language, "reportGeneration"), icon: "📋" },
    { id: "hotspots", label: t(language, "corruptionHotspots"), icon: "🔥" },
    { id: "users", label: t(language, "userManagement"), icon: "👤" },
    { id: "dashboard", label: t(language, "systemOverview"), icon: "📜" },
  ];

  const getMenuItems = () => {
    switch (user.role) {
      case UserRole.ADMIN:
        return [...commonItems, ...adminItems];
      case UserRole.INVESTIGATOR:
        return [...commonItems, ...investigatorItems];
      default:
        return [...commonItems, ...whistleblowerItems];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside
      className={`${expanded ? "w-72" : "w-20 md:w-64"} bg-white dark:bg-[#04060b] border-r border-slate-200 dark:border-white/5 flex flex-col transition-all duration-300 relative z-50 overflow-y-auto max-h-screen`}
    >
      <div className="p-4 md:p-6 mb-2">
        <div className="flex items-center justify-between gap-3">
          <img src="/zacc-logo.png" alt="ZACC" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-nexus-emerald/10" />
          <button
            className="md:hidden text-slate-700 dark:text-slate-300"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-2">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                isActive
                  ? "bg-nexus-emerald/10 text-nexus-emerald border border-nexus-emerald/20"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
              }`}
            >
              <span
                className={`text-2xl transition-transform group-hover:scale-110 ${isActive ? "scale-110" : ""} relative`}
              >
                {item.icon}
                {item.id === "investigator" && notificationCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-lg">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
              <span
                className={`hidden md:block font-black text-[11px] uppercase tracking-widest transition-colors ${isActive ? "text-nexus-emerald" : ""}`}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute right-0 w-1.5 h-6 bg-nexus-emerald rounded-l-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
              )}
            </button>
          );
        })}

        <div className="pt-6 px-2 hidden md:block">
          <div className="h-[1px] bg-slate-200 dark:bg-white/5 w-full mb-6"></div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 ml-2">
            Privacy Controls
          </p>

          <button
            onClick={toggleStealth}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all mb-3 border ${
              stealthActive
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-slate-100 dark:bg-white/5 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <span className="text-xl">{stealthActive ? "👁️‍🗨️" : "👁️"}</span>
            <span className="font-black text-[10px] uppercase tracking-widest hidden lg:block">
              {stealthActive ? "Stealth: ON" : "Stealth Mode"}
            </span>
          </button>

          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            className="w-full mt-2 p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="en">English</option>
            <option value="sn">Shona</option>
            <option value="nd">Ndebele</option>
            <option value="to">Tonga</option>
          </select>


        </div>
      </nav>

      <div className="p-4 mt-auto">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center md:justify-start md:gap-3 p-3 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 transition-all font-black text-xs uppercase tracking-widest"
        >
          <span className="text-2xl">🚪</span>
          <span className="hidden md:block truncate">
            {t(language, "signOut")}
          </span>
        </button>
      </div>
    </aside>
  );
};
