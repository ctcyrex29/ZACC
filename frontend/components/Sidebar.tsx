import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  currentView,
  setView,
  onLogout,
  language,
  onLanguageChange,
}) => {
  const [stealthActive, setStealthActive] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const iconMap: Record<string, keyof typeof LucideIcons> = {
    dashboard: "Home",
    report: "FileText",
    tracking: "Search",
    investigator: "Shield",
    authorities: "Send",
    reports: "BarChart3",
    hotspots: "Flame",
    users: "Users",
    logout: "LogOut",
  };

  const renderIcon = (icon: string) => {
    const iconName = iconMap[icon] ?? "Circle";
    const IconComponent = LucideIcons[iconName] as React.ComponentType<{
      className?: string;
      strokeWidth?: number;
      "aria-hidden"?: boolean;
    }>;

    return <IconComponent className="w-5 h-5" strokeWidth={2.2} aria-hidden={true} />;
  };

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
      icon: "dashboard",
    },
  ];

  const whistleblowerItems = [
    { id: "report", label: t(language, "reportCase"), icon: "report" },
    { id: "tracking", label: t(language, "myReports"), icon: "tracking" },
  ];

  const investigatorItems = [
    { id: "investigator", label: t(language, "controlCenter"), icon: "investigator" },
    { id: "authorities", label: "Referred", icon: "authorities" },
    { id: "reports", label: t(language, "reportGeneration"), icon: "reports" },
    { id: "hotspots", label: t(language, "corruptionHotspots"), icon: "hotspots" },
  ];

  const adminItems = [
    { id: "investigator", label: t(language, "controlCenter"), icon: "investigator" },
    { id: "authorities", label: "Referred", icon: "authorities" },
    { id: "reports", label: t(language, "reportGeneration"), icon: "reports" },
    { id: "hotspots", label: t(language, "corruptionHotspots"), icon: "hotspots" },
    { id: "users", label: t(language, "userManagement"), icon: "users" },
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
      className={`${expanded ? "w-72" : "w-20 md:w-64"} bg-[var(--zacc-sidebar)] border-r border-[var(--zacc-sidebar-border)] flex flex-col transition-all duration-300 relative z-50 overflow-y-auto max-h-screen text-[var(--zacc-sidebar-text)]`}
    >
      <div className="p-4 md:p-6 mb-2 border-b border-white/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg">
              Z
            </div>
            <div className="hidden md:block min-w-0">
              <p className="font-black text-xl text-white leading-none">ZACC</p>
              <p className="text-[11px] uppercase tracking-wider text-blue-100/90 truncate">Admin Management System</p>
            </div>
          </div>
          <button
            className="md:hidden text-white"
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
                  ? "bg-[var(--zacc-sidebar-item)] text-[var(--zacc-sidebar-text-active)] border border-white/25"
                  : "text-[var(--zacc-sidebar-text)] hover:text-white hover:bg-[var(--zacc-sidebar-item-hover)] border border-transparent"
              }`}
            >
              <span
                className={`text-2xl transition-transform group-hover:scale-110 ${isActive ? "scale-110" : ""} relative`}
              >
                {renderIcon(item.icon)}
              </span>
              <span
                className={`hidden md:block font-black text-[11px] uppercase tracking-widest transition-colors ${isActive ? "text-[var(--zacc-sidebar-text-active)]" : ""}`}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute right-0 w-1.5 h-6 bg-white rounded-l-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
              )}
            </button>
          );
        })}

        <div className="pt-6 px-2 hidden md:block">
          <div className="h-[1px] bg-white/20 w-full mb-6"></div>
          <p className="text-[9px] font-black text-blue-100/80 uppercase tracking-[0.3em] mb-4 ml-2">
            Privacy Controls
          </p>

          <button
            onClick={toggleStealth}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all mb-3 border ${
              stealthActive
                ? "bg-amber-500/20 border-amber-300/40 text-amber-100"
                : "bg-white/10 border-white/15 text-blue-100 hover:text-white hover:bg-white/15"
            }`}
          >
            <span className="text-xl">
              {stealthActive ? (
                <LucideIcons.EyeOff className="w-5 h-5" strokeWidth={2.25} aria-hidden={true} />
              ) : (
                <LucideIcons.Eye className="w-5 h-5" strokeWidth={2.25} aria-hidden={true} />
              )}
            </span>
            <span className="font-black text-[10px] uppercase tracking-widest hidden lg:block">
              {stealthActive ? "Stealth: ON" : "Stealth Mode"}
            </span>
          </button>

          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold text-white"
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
          className="w-full flex items-center justify-center md:justify-start md:gap-3 p-3 rounded-xl text-blue-100 hover:text-white hover:bg-rose-500/20 transition-all font-black text-xs uppercase tracking-widest"
        >
          <span className="text-2xl">{renderIcon("logout")}</span>
          <span className="hidden md:block truncate">
            {t(language, "signOut")}
          </span>
        </button>
      </div>
    </aside>
  );
};
