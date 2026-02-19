import React, { useState } from "react";
import { User, UserRole } from "../types";
import { View } from "../App";

interface SidebarProps {
    user: User;
    currentView: string;
    setView: (view: View) => void;
    onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    user,
    currentView,
    setView,
    onLogout,
}) => {
    const [stealthActive, setStealthActive] = useState(false);

    const toggleStealth = () => {
        setStealthActive(!stealthActive);
        document.documentElement.classList.toggle("stealth-blur");
    };

    const panicExit = () => {
        window.location.href =
            "https://www.google.com/search?q=zimbabwe+weather";
    };

    const commonItems = [
        { id: "dashboard", label: "Overview", icon: "📊" },
        { id: "chat", label: "AI Assistant", icon: "💬" },
    ];

    const whistleblowerItems = [
        { id: "report", label: "Report Incident", icon: "📝" },
        { id: "tracking", label: "My Reports", icon: "🛰️" },
        { id: "hub", label: "Protection Hub", icon: "🛡️" },
        { id: "media", label: "Awareness", icon: "🎨" },
    ];

    const investigatorItems = [
        { id: "investigator", label: "Active Cases", icon: "📂" },
    ];

    const adminItems = [
        { id: "investigator", label: "Active Cases", icon: "📂" },
        { id: "users", label: "User Management", icon: "👤" },
        { id: "dashboard", label: "System Logs", icon: "📜" },
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
        <aside className="w-20 lg:w-64 bg-[#04060b] border-r border-white/5 flex flex-col transition-all duration-300 relative z-50">
            <div className="p-8 mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-nexus-emerald to-emerald-800 rounded-2xl flex items-center justify-center font-black text-nexus-950 text-2xl shadow-lg shadow-nexus-emerald/10">
                        Z
                    </div>
                    <div className="hidden lg:block overflow-hidden">
                        <h2 className="font-black text-white tracking-tighter text-xl leading-none">
                            NEXUS
                        </h2>
                        <p className="text-[9px] text-nexus-emerald mt-1 font-black tracking-[0.2em] uppercase">
                            Integrity Uplink
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {menuItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as View)}
                            className={`w-full flex items-center lg:gap-5 p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                                isActive
                                    ? "bg-nexus-emerald/10 text-nexus-emerald border border-nexus-emerald/20"
                                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                            }`}
                        >
                            <span
                                className={`text-2xl transition-transform group-hover:scale-110 ${isActive ? "scale-110" : ""}`}
                            >
                                {item.icon}
                            </span>
                            <span
                                className={`hidden lg:block font-black text-xs uppercase tracking-widest transition-colors ${isActive ? "text-nexus-emerald" : ""}`}
                            >
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="absolute right-0 w-1.5 h-6 bg-nexus-emerald rounded-l-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                            )}
                        </button>
                    );
                })}

                <div className="pt-8 px-2 hidden lg:block">
                    <div className="h-[1px] bg-white/5 w-full mb-8"></div>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 ml-2">
                        Privacy Controls
                    </p>

                    <button
                        onClick={toggleStealth}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all mb-3 border ${
                            stealthActive
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                    >
                        <span className="text-xl">
                            {stealthActive ? "👁️‍🗨️" : "👁️"}
                        </span>
                        <span className="font-black text-[10px] uppercase tracking-widest">
                            {stealthActive ? "Stealth: ON" : "Stealth Mode"}
                        </span>
                    </button>

                    <button
                        onClick={panicExit}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-rose-500/10 border border-transparent hover:border-rose-500/40 text-rose-500 transition-all group"
                    >
                        <span className="text-xl group-hover:rotate-12 transition-transform">
                            🚪
                        </span>
                        <span className="font-black text-[10px] uppercase tracking-widest">
                            Panic Exit
                        </span>
                    </button>
                </div>
            </nav>

            <div className="p-6 mt-auto">
                <div className="mb-6 p-5 rounded-[2rem] bg-[#080c18] border border-white/5 hidden lg:block relative overflow-hidden group">
                    <div className="absolute top-[-10%] right-[-10%] w-20 h-20 bg-nexus-emerald/5 blur-2xl rounded-full"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Identity Key
                    </p>
                    <div className="flex items-center justify-between gap-2">
                        <code className="text-[10px] font-black text-nexus-emerald bg-nexus-emerald/10 px-3 py-2 rounded-xl border border-nexus-emerald/10 truncate">
                            {user.nexusKey}
                        </code>
                        <button className="text-[10px] hover:scale-110 transition-transform">
                            📋
                        </button>
                    </div>
                </div>

                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center lg:justify-start lg:gap-5 p-4 rounded-2xl text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 transition-all font-black text-xs uppercase tracking-widest"
                >
                    <span className="text-2xl">🔒</span>
                    <span className="hidden lg:block truncate">
                        End Session
                    </span>
                </button>
            </div>
        </aside>
    );
};
