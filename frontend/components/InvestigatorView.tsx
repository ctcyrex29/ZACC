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
                if (
                    response &&
                    response.success &&
                    Array.isArray(response.data)
                ) {
                    setCases(response.data);
                } else {
                    // Fallback to local storage if API fails or is not seeded
                    const saved = JSON.parse(
                        localStorage.getItem("zacc_cases") || "[]",
                    );
                    setCases(saved);
                }
            } catch (err) {
                console.error("Failed to fetch cases:", err);
                const saved = JSON.parse(
                    localStorage.getItem("zacc_cases") || "[]",
                );
                setCases(saved);
            } finally {
                setLoading(false);
            }
        };

        fetchCases();
    }, []);

    const filteredCases =
        filter === "ALL" ? cases : cases.filter((c) => c.status === filter);

    const getStatusColor = (status: CaseStatus) => {
        switch (status) {
            case CaseStatus.SUBMITTED:
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case CaseStatus.INVESTIGATING:
                return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case CaseStatus.CLOSED:
                return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case CaseStatus.DISPUTED:
                return "bg-rose-500/10 text-rose-500 border-rose-500/20";
            default:
                return "bg-slate-500/10 text-slate-400 border-slate-500/20";
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                        Investigation Pipeline
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                        Authorized Investigator Access Only
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {(["ALL", ...Object.values(CaseStatus)] as const).map(
                        (s) => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    filter === s
                                        ? "bg-nexus-emerald text-nexus-950 border-nexus-emerald"
                                        : "bg-white/5 text-slate-500 border-transparent hover:border-white/10"
                                }`}
                            >
                                {s}
                            </button>
                        ),
                    )}
                </div>
            </div>

            <div className="glass-card rounded-[3rem] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Reference
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Category
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Institution
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Risk Score
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Status
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-8 py-20 text-center"
                                    >
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-8 h-8 border-2 border-nexus-emerald/30 border-t-nexus-emerald rounded-full animate-spin"></div>
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                Decrypting Dossiers...
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCases.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-8 py-20 text-center"
                                    >
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            No cases matching telemetry
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCases.map((c) => (
                                    <tr
                                        key={c.id}
                                        className="hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="px-8 py-6">
                                            <code className="text-[10px] font-black text-nexus-emerald bg-nexus-emerald/10 px-2 py-1 rounded-lg">
                                                {c.referenceCode ||
                                                    String(c.id).slice(0, 8)}
                                            </code>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-xs font-black text-white uppercase tracking-tight">
                                                {c.type}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-xs font-medium text-slate-400">
                                                {c.institution}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${c.riskScore > 75 ? "bg-rose-500" : c.riskScore > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                        style={{
                                                            width: `${c.riskScore}%`,
                                                        }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-500">
                                                    {c.riskScore}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span
                                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(c.status)}`}
                                            >
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        setModalLoading(true);
                                                        setModalOpen(true);
                                                        // Attempt to fetch by case id or numeric id
                                                        const idToFetch =
                                                            c.id ||
                                                            c.case_id ||
                                                            c.referenceCode;
                                                        const response =
                                                            await apiClient.get(
                                                                `/reports/${idToFetch}`,
                                                            );
                                                        if (
                                                            response &&
                                                            response.success
                                                        ) {
                                                            setModalReport(
                                                                response.data,
                                                            );
                                                        } else {
                                                            setModalReport({
                                                                error:
                                                                    response?.message ||
                                                                    "Failed to load report",
                                                            });
                                                        }
                                                    } catch (err: any) {
                                                        setModalReport({
                                                            error:
                                                                err.message ||
                                                                "Failed to load report",
                                                        });
                                                    } finally {
                                                        setModalLoading(false);
                                                    }
                                                }}
                                                className="text-[10px] font-black text-nexus-emerald uppercase tracking-widest hover:underline"
                                            >
                                                Review Dossier
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#04101a] border border-white/5">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-lg font-black text-white">
                                Dossier Review
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setModalOpen(false);
                                        setModalReport(null);
                                    }}
                                    className="text-sm text-slate-400 hover:text-white"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="min-h-[120px]">
                            {modalLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-nexus-emerald/30 border-t-nexus-emerald rounded-full animate-spin"></div>
                                </div>
                            ) : modalReport ? (
                                modalReport.error ? (
                                    <div className="p-4 bg-rose-500/10 rounded-lg text-rose-400">
                                        {modalReport.error}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-slate-400">
                                                    Reference
                                                </p>
                                                <p className="font-mono font-bold text-nexus-emerald">
                                                    {modalReport.reference_code ||
                                                        modalReport.case_id ||
                                                        modalReport.id}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">
                                                    Status
                                                </p>
                                                <p className="font-bold text-white">
                                                    {modalReport.status}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-nexus-950/40 rounded-xl border border-white/5">
                                            <p className="text-sm text-slate-400 italic">
                                                {(modalReport.decrypted_data &&
                                                    modalReport.decrypted_data
                                                        .description) ||
                                                    modalReport.description ||
                                                    "No description available"}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-400">
                                                    Institution
                                                </p>
                                                <p className="text-sm text-white">
                                                    {(modalReport.decrypted_data &&
                                                        modalReport
                                                            .decrypted_data
                                                            .institution) ||
                                                        modalReport.institution}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">
                                                    Location
                                                </p>
                                                <p className="text-sm text-white">
                                                    {(modalReport.decrypted_data &&
                                                        modalReport
                                                            .decrypted_data
                                                            .location) ||
                                                        modalReport.location ||
                                                        "N/A"}
                                                </p>
                                            </div>
                                        </div>

                                        {modalReport.ai_summary && (
                                            <div className="p-4 bg-white/3 rounded-xl border border-white/5 mt-4">
                                                <p className="text-xs text-slate-400">
                                                    AI Expert Summary
                                                </p>
                                                <pre className="whitespace-pre-wrap text-sm text-white mt-2">
                                                    {JSON.stringify(
                                                        modalReport.ai_summary,
                                                        null,
                                                        2,
                                                    )}
                                                </pre>
                                            </div>
                                        )}

                                        <div className="mt-4">
                                            <p className="text-xs text-slate-400">
                                                Action Comment (required for
                                                investigators)
                                            </p>
                                            <textarea
                                                value={actionComment}
                                                onChange={(e) =>
                                                    setActionComment(
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-full mt-2 p-3 rounded-lg bg-[#031018] border border-white/5 text-sm text-white"
                                                rows={3}
                                                placeholder="Add a short comment describing your action or findings"
                                            />

                                            <div className="flex items-center justify-end gap-2 mt-3">
                                                {[
                                                    "UNDER_REVIEW",
                                                    "INVESTIGATING",
                                                    "CLOSED",
                                                    "REFERRED",
                                                ].map((s) => (
                                                    <button
                                                        key={s}
                                                        disabled={
                                                            actionProcessing
                                                        }
                                                        onClick={async () => {
                                                            if (!modalReport)
                                                                return;
                                                            try {
                                                                setActionProcessing(
                                                                    true,
                                                                );
                                                                const idToUpdate =
                                                                    modalReport.id ||
                                                                    modalReport.case_id;
                                                                const payload =
                                                                    {
                                                                        status: s,
                                                                        comment:
                                                                            actionComment,
                                                                    };
                                                                const resp =
                                                                    await apiClient.put(
                                                                        `/reports/${idToUpdate}/status`,
                                                                        payload,
                                                                    );
                                                                if (
                                                                    resp &&
                                                                    resp.success
                                                                ) {
                                                                    setModalReport(
                                                                        resp.data,
                                                                    );
                                                                    // Update local cases list to reflect status change
                                                                    setCases(
                                                                        (
                                                                            prev,
                                                                        ) =>
                                                                            prev.map(
                                                                                (
                                                                                    c,
                                                                                ) =>
                                                                                    c.id ===
                                                                                    resp
                                                                                        .data
                                                                                        .id
                                                                                        ? resp.data
                                                                                        : c,
                                                                            ),
                                                                    );
                                                                    setActionComment(
                                                                        "",
                                                                    );
                                                                } else {
                                                                    alert(
                                                                        resp?.message ||
                                                                            "Failed to update status",
                                                                    );
                                                                }
                                                            } catch (err: any) {
                                                                alert(
                                                                    err.message ||
                                                                        "Failed to update status",
                                                                );
                                                            } finally {
                                                                setActionProcessing(
                                                                    false,
                                                                );
                                                            }
                                                        }}
                                                        className="px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="text-slate-400">
                                    No report loaded.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
