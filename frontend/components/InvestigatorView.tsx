import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "../services/api";
import { CaseReport, CaseStatus, User, UserRole } from "../types";
import { ALL_LANGUAGES, getLanguageName } from "../lib/languages";

interface InvestigatorViewProps {
  user: User;
  onCaseViewed?: (caseId: string | number) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    INVESTIGATING: "Investigating",
    REFERRED: "Referred to Other Authorities",
    SUCCESSFUL: "✓ Successful",
    CLOSED: "Closed",
    DISPUTED: "Disputed",
  };
  return map[s] ?? s;
};

const statusBadge = (s: string) => {
  if (s === "SUBMITTED")
    return "bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-200   dark:border-blue-500/20";
  if (s === "UNDER_REVIEW")
    return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20";
  if (s === "INVESTIGATING")
    return "bg-amber-500/10 text-amber-600  dark:text-amber-400  border-amber-200  dark:border-amber-500/20";
  if (s === "REFERRED")
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20";
  if (s === "SUCCESSFUL")
    return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/20";
  if (s === "CLOSED")
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
  if (s === "DISPUTED")
    return "bg-rose-500/10   text-rose-600   dark:text-rose-400   border-rose-200   dark:border-rose-500/20";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20";
};

const priorityColor = (p: string) => {
  if (p === "CRITICAL") return "text-rose-600 dark:text-rose-400";
  if (p === "HIGH") return "text-orange-600 dark:text-orange-400";
  if (p === "MEDIUM") return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const CASE_BOOK_STAGES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INVESTIGATING",
  "REFERRED",
  "SUCCESSFUL",
  "CLOSED",
] as const;

const stageIndex = (status?: string) => {
  const idx = CASE_BOOK_STAGES.indexOf((status || "") as (typeof CASE_BOOK_STAGES)[number]);
  return idx === -1 ? 0 : idx;
};

const attachmentIcon = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("officedocument")) return "📝";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
  return "📎";
};

// ── PDF Generator ─────────────────────────────────────────────────────────
function generateStagePDF(caseData: any, stage: any) {
  const inv = stage.investigator;
  const invName = inv?.name || "Investigator";
  const invEmail = inv?.email || "";
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const reportId =
    "ZACC/RPT/REF/" +
    new Date().getFullYear() +
    "/" +
    Date.now().toString(36).toUpperCase();
  const win = window.open("", "_blank", "width=900,height=750");
  if (!win) return;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>ZACC Official Filing - Referral Stage Report - ${caseData.reference_code || caseData.case_id}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm 25mm 18mm; }
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Times New Roman',Georgia,'Segoe UI',serif;color:#1a1a1a;background:#fff;font-size:11pt;line-height:1.6;}
    .page{max-width:760px;margin:0 auto;padding:30px 40px;}
    .official-header{text-align:center;padding-bottom:18px;border-bottom:3px double #1a472a;margin-bottom:20px;}
    .coat-of-arms{width:72px;height:72px;margin:0 auto 10px;border-radius:50%;overflow:hidden;border:3px solid #b5985a;}
    .coat-of-arms img{width:100%;height:100%;object-fit:cover;}
    .state-name{font-size:9pt;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#666;margin-bottom:2px;}
    .commission-name{font-size:15pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#1a472a;margin-bottom:2px;}
    .commission-sub{font-size:9pt;color:#555;font-style:italic;margin-bottom:8px;}
    .motto{font-size:8pt;color:#888;font-style:italic;letter-spacing:1px;}
    .doc-meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding:12px 16px;background:#f9f7f2;border:1px solid #e5e0d5;border-radius:4px;}
    .doc-meta-left{text-align:left;} .doc-meta-right{text-align:right;}
    .doc-meta .label{font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;}
    .doc-meta .value{font-size:10pt;font-weight:bold;color:#1a1a1a;}
    .doc-meta .ref-num{font-size:11pt;font-weight:bold;color:#1a472a;font-family:'Courier New',monospace;}
    .classification{display:inline-block;font-size:8pt;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#b91c1c;border:2px solid #b91c1c;padding:2px 10px;border-radius:2px;margin-top:4px;}
    .doc-title{text-align:center;margin:20px 0;padding:16px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc;}
    .doc-title h1{font-size:16pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a;margin-bottom:4px;}
    .doc-title .subtitle{font-size:10pt;color:#555;}
    .section{margin-bottom:22px;}
    .section-num{font-size:11pt;font-weight:bold;color:#1a472a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;}
    .section-body{font-size:10.5pt;color:#333;text-align:justify;}
    .section-body p{margin-bottom:8px;}
    .priority-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt;}
    .priority-table th{background:#1a472a;color:#fff;padding:8px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;}
    .priority-table td{padding:8px 12px;border-bottom:1px solid #e5e5e5;vertical-align:top;}
    .priority-table tr:nth-child(even) td{background:#fafaf7;}
    .notes-box{font-size:10pt;color:#333;line-height:1.65;background:#f9f7f2;border-left:3px solid #1a472a;border:1px solid #e5e0d5;border-left-width:3px;border-radius:4px;padding:12px;}
    .doc-footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:8pt;color:#999;}
    @media print { body{padding:0;} .page{padding:0;} }
  </style>
</head>
<body>
<div class="page">
  <div class="official-header">
    <div class="coat-of-arms"><img src="${window.location.origin}/zacc-logo.png" alt="ZACC"/></div>
    <div class="state-name">Republic of Zimbabwe</div>
    <div class="commission-name">Zimbabwe Anti-Corruption Commission</div>
    <div class="commission-sub">Established under Section 254 of the Constitution of Zimbabwe</div>
    <div class="motto">"Fighting Corruption, Promoting Integrity"</div>
  </div>

  <div class="doc-meta">
    <div class="doc-meta-left">
      <span class="label">Document Reference</span>
      <span class="ref-num">${reportId}</span>
      <br/><span class="classification">CONFIDENTIAL</span>
    </div>
    <div class="doc-meta-right">
      <span class="label">Date of Issue</span>
      <span class="value">${dateStr}</span><br/>
      <span class="label" style="margin-top:6px;">Prepared By</span>
      <span class="value">${invName}</span>
    </div>
  </div>

  <div class="doc-title">
    <h1>Referral Stage Case Report</h1>
    <div class="subtitle">Case: ${caseData.reference_code || caseData.case_id || caseData.id || "N/A"}</div>
  </div>

  <div class="section">
    <div class="section-num">1. Case Details</div>
    <table class="priority-table">
      <thead>
        <tr>
          <th>Case Reference</th>
          <th>Case ID</th>
          <th>Corruption Type</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${caseData.reference_code || "—"}</td>
          <td>${caseData.case_id || caseData.id || "—"}</td>
          <td>${caseData.type || "—"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-num">2. Stage Action</div>
    <table class="priority-table">
      <thead>
        <tr>
          <th>Stage</th>
          <th>Action Date &amp; Time</th>
          <th>Assessment Score</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${statusLabel(stage.stage)}</td>
          <td>${new Date(stage.created_at).toLocaleString()}</td>
          <td>${stage.final_score != null ? stage.final_score + " / 100" : "—"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-num">3. Action Performed By</div>
    <table class="priority-table">
      <thead>
        <tr>
          <th>Officer Name</th>
          <th>Officer Email</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${invName}</td>
          <td>${invEmail || "—"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-num">4. Report Statement</div>
    <div class="notes-box">${stage.investigator_notes || "No statement recorded."}</div>
  </div>

  <div class="doc-footer">
    <div>Zimbabwe Anti-Corruption Commission<br/>This document is confidential. Unauthorised disclosure is an offence under the Official Secrets Act.</div>
    <div style="text-align:right;">Ref: ${reportId}<br/>Generated: ${new Date().toLocaleString()}</div>
  </div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),500);</script>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

// ── Component ──────────────────────────────────────────────────────────────
export const InvestigatorView: React.FC<InvestigatorViewProps> = ({ user, onCaseViewed }) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CaseStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [typeCorrectionAudit, setTypeCorrectionAudit] = useState<any[]>([]);
  const [typeCorrectionLoading, setTypeCorrectionLoading] = useState(false);

  // Dossier modal
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState<any | null>(null);
  const [stagesData, setStagesData] = useState<any[]>([]);

  // Action state (investigators only)
  const [actionNotes, setActionNotes] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showReferralMenu, setShowReferralMenu] = useState(false);
  const [referralDraft, setReferralDraft] = useState({
    authority: "National Prosecuting Authority (NPA)",
    legalBasis:
      "Evidence indicates potential criminal conduct requiring prosecution review under applicable anti-corruption and criminal law frameworks.",
    reference: "",
    transmissionDate: new Date().toISOString().slice(0, 10),
  });

  // Expert review state
  const [expertReview, setExpertReview] = useState<any | null>(null);
  const [expertReviewLoading, setExpertReviewLoading] = useState(false);

  // Pre-review findings report state
  const [preReviewReport, setPreReviewReport] = useState<any | null>(null);
  const [preReviewLoading, setPreReviewLoading] = useState(false);

  // Investigation log entries (detective platform)
  const [investigationLogs, setInvestigationLogs] = useState<Array<{date: string; account: string; finding: string; progress: string}>>([]);
  const [logEntry, setLogEntry] = useState({account: "", finding: "", progress: "In Progress"});

  // Translation state
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateLang, setTranslateLang] = useState<string>("en");

  // Evidence preview state
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Toggle inline evidence preview for text and image files ──
  const togglePreview = async (attachment: any) => {
    const attId = String(attachment.id);
    if (previewAttachmentId === attId) {
      setPreviewAttachmentId(null);
      setPreviewContent(null);
      setPreviewUrl(null);
      return;
    }
    setPreviewAttachmentId(attId);
    setPreviewContent(null);
    setPreviewUrl(null);
    setPreviewLoading(true);

    const mime = (attachment.mime_type || "").toLowerCase();
    const caseId = dossierData?.case_id || dossierData?.id;
    const dlUrl = attachment.download_url || `/api/reports/${caseId}/attachments/${attachment.id}/download`;

    try {
      const token = localStorage.getItem("nexus_token");
      const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
      let fetchUrl = dlUrl;
      try {
        const parsed = new URL(dlUrl);
        if (parsed.pathname.startsWith("/api/")) fetchUrl = apiBase + parsed.pathname;
      } catch { fetchUrl = apiBase + (dlUrl.startsWith("/") ? dlUrl : "/" + dlUrl); }

      const resp = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
      });
      if (!resp.ok) throw new Error("Failed to fetch");

      if (mime.startsWith("image/")) {
        const blob = await resp.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      } else if (mime.startsWith("text/") || mime.includes("json") || mime.includes("csv") || mime.includes("xml") || mime.includes("markdown")) {
        const text = await resp.text();
        setPreviewContent(text.slice(0, 5000));
      } else if (mime.startsWith("video/")) {
        const blob = await resp.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      } else if (mime.startsWith("audio/")) {
        const blob = await resp.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch {
      setPreviewContent("Unable to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Fetch cases ──
  const fetchCases = useCallback(async () => {
    try {
      const response = await apiClient.getReports();
      if (response?.success && Array.isArray(response.data)) {
        setCases(
          response.data.map((r: any) => ({
            id: r.case_id || r.id,
            case_id: r.case_id,
            timestamp: r.created_at,
            type: r.type,
            description: r.description || "",
            location: r.location || "",
            institution: r.institution || "",
            status: r.status,
            riskScore: r.risk_score,
            priority: r.priority,
            reporterId: r.user_id,
            referenceCode: r.reference_code,
            attachments_count: r.attachments_count,
            stage_evaluations_count: r.stage_evaluations_count,
          })),
        );
      } else {
        setCases(JSON.parse(localStorage.getItem("zacc_cases") || "[]"));
      }
    } catch {
      setCases(JSON.parse(localStorage.getItem("zacc_cases") || "[]"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.getNotifications();
      if (response?.success && Array.isArray(response.data)) {
        setNotifications(response.data);
      }
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchNotifications]);

  const fetchTypeCorrectionAudit = useCallback(async () => {
    setTypeCorrectionLoading(true);
    try {
      const response = await apiClient.getTypeCorrectionAudit(12);
      if (response?.success && Array.isArray(response.data)) {
        setTypeCorrectionAudit(response.data);
      } else {
        setTypeCorrectionAudit([]);
      }
    } catch {
      setTypeCorrectionAudit([]);
    } finally {
      setTypeCorrectionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypeCorrectionAudit();
  }, [fetchTypeCorrectionAudit]);

  // ── Authenticated evidence download (avoids 401 from <a href target="_blank">) ──
  const downloadEvidence = async (url: string, fileName: string) => {
    try {
      const token = localStorage.getItem("nexus_token");
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

      // Normalize the download URL: extract the /api/... path and prepend the correct API origin
      let downloadUrl = url;
      try {
        const parsed = new URL(url);
        if (parsed.pathname.startsWith('/api/')) {
          downloadUrl = apiBase + parsed.pathname;
        }
      } catch {
        // url was relative — prepend API base
        downloadUrl = apiBase + (url.startsWith('/') ? url : '/' + url);
      }

      const resp = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: '*/*',
        },
      });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success(`Downloaded: ${fileName}`);
    } catch (err) {
      console.error("Evidence download error:", err);
      toast.error("Failed to download evidence file. Please try again.");
    }
  };

  // ── Load stages for open dossier ──
  const loadStages = useCallback(async (reportId: string) => {
    try {
      const resp = await apiClient.getStageEvaluations(reportId);
      if (resp?.success && Array.isArray(resp.data)) {
        setStagesData(resp.data);
      }
    } catch {
      setStagesData([]);
    }
  }, []);

  // ── Open dossier ──
  const openDossier = async (c: CaseReport) => {
    setDossierOpen(true);
    setDossierLoading(true);
    setDossierData(null);
    setStagesData([]);
    setActionNotes("");
    setActionError(null);
    setShowReferralMenu(false);
    setPreReviewReport(null);
    setTranslatedText(null);
    setTranslateLoading(false);

    const resolvedId = (c as any).case_id || c.id;

    // Investigators: If SUBMITTED → auto-advance to UNDER_REVIEW
    // Admins do NOT advance cases — they only monitor
    if (!isAdmin && c.status === CaseStatus.SUBMITTED) {
      try {
        await apiClient.createStageEvaluation(resolvedId, {
          stage: "UNDER_REVIEW",
          investigator_notes:
            "Case dossier opened. Proceeding to validity review.",
        });
        setCases((prev) =>
          prev.map((x) =>
            x.id === c.id || (x as any).case_id === resolvedId
              ? { ...x, status: CaseStatus.UNDER_REVIEW }
              : x,
          ),
        );
      } catch {
        // continue even if status update fails
      }
    }

    // Mark this case's notification as viewed so the sidebar badge decrements
    // Use await to ensure localStorage is updated before re-filtering
    await onCaseViewed?.(resolvedId);

    // Force local notification list to re-filter
    setNotifications((prev) => [...prev]);

    try {
      const resp = await apiClient.get(`/reports/${resolvedId}`);
      if (resp?.success) {
        setDossierData(resp.data);
        await loadStages(resolvedId);
        // Auto-run pre-review analysis in background
        runPreReviewAnalysis(resolvedId);
      } else {
        setDossierData({ error: resp?.message || "Failed to load case" });
      }
    } catch (err: any) {
      setDossierData({ error: err.message || "Failed to load case" });
    } finally {
      setDossierLoading(false);
    }
  };

  // ── Stage action (investigators only) ──
  const doAction = async (
    targetStage: string,
    requireNotes = true,
    extraPayload: Record<string, unknown> = {},
  ) => {
    if (isAdmin) return;
    if (requireNotes && actionNotes.trim().length < 10) {
      toast.error("Please provide a report statement (minimum 10 characters) before proceeding.");
      return;
    }
    setActionProcessing(true);
    setActionError(null);
    const id = dossierData?.case_id || dossierData?.id;
    try {
      const resp = await apiClient.createStageEvaluation(id, {
        stage: targetStage,
        investigator_notes:
          actionNotes.trim() || "Stage advanced by investigator.",
        ...extraPayload,
      });
      if (resp?.success) {
        toast.success(`Case advanced to ${targetStage.replace("_", " ")} stage`);
        const updatedStatus = targetStage as CaseStatus;
        setDossierData((prev: any) => ({ ...prev, status: updatedStatus }));
        setCases((prev) =>
          prev.map((x) =>
            x.id === id || (x as any).case_id === id
              ? { ...x, status: updatedStatus }
              : x,
          ),
        );
        setActionNotes("");
        setShowReferralMenu(false);
        await loadStages(id);
      } else {
        toast.error(resp?.message || "Action failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Action failed.");
    } finally {
      setActionProcessing(false);
    }
  };

  const closeDossier = () => {
    setDossierOpen(false);
    setDossierData(null);
    setStagesData([]);
    setActionNotes("");
    setActionError(null);
    setShowReferralMenu(false);
    setExpertReview(null);
    setPreReviewReport(null);
    setInvestigationLogs([]);
    setLogEntry({account: "", finding: "", progress: "In Progress"});
    setReferralDraft({
      authority: "National Prosecuting Authority (NPA)",
      legalBasis:
        "Evidence indicates potential criminal conduct requiring prosecution review under applicable anti-corruption and criminal law frameworks.",
      reference: "",
      transmissionDate: new Date().toISOString().slice(0, 10),
    });
  };

  const runExpertReview = useCallback(async () => {
    if (!dossierData) return;
    setExpertReviewLoading(true);
    try {
      const id = dossierData.case_id || dossierData.id;
      const resp = await apiClient.expertCaseReview(id);
      if (resp.success) setExpertReview(resp.data);
      else setExpertReview({ error: resp.message || "Review failed" });
    } catch (err: any) {
      setExpertReview({ error: err.message || "Review failed" });
    } finally {
      setExpertReviewLoading(false);
    }
  }, [dossierData]);

  useEffect(() => {
    if (!dossierOpen || !dossierData) return;
    if (["CLOSED", "DISPUTED", "SUCCESSFUL"].includes(dossierData.status)) {
      runExpertReview();
    }
  }, [dossierOpen, dossierData, runExpertReview]);

  const runPreReviewAnalysis = async (reportId?: string) => {
    const id = reportId || dossierData?.case_id || dossierData?.id;
    if (!id) return;
    setPreReviewLoading(true);
    try {
      const resp = await apiClient.preReviewAnalysis(id);
      if (resp.success) setPreReviewReport(resp.data);
      else setPreReviewReport({ error: resp.message || "Analysis failed" });
    } catch (err: any) {
      setPreReviewReport({ error: err.message || "Analysis failed" });
    } finally {
      setPreReviewLoading(false);
    }
  };

  // ── Derived lists ──
  const priorityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const filteredCases = cases.filter((c) => {
    if (!isAdmin && c.status === CaseStatus.REFERRED) {
      return false;
    }
    const matchesFilter = filter === "ALL" || c.status === filter;
    const matchesSearch =
      !search ||
      c.type?.toLowerCase().includes(search.toLowerCase()) ||
      c.institution?.toLowerCase().includes(search.toLowerCase()) ||
      (c.referenceCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.id || "").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    // Sort by newest first (most recent timestamp on top)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const currentStatus: string = dossierData?.status ?? "";
  const decrypted = dossierData?.decrypted_data ?? {};
  const currentStageIndex = stageIndex(currentStatus);
  const bookmarkStage = CASE_BOOK_STAGES[currentStageIndex] ?? "SUBMITTED";
  const caseAttachments: any[] = Array.isArray(dossierData?.attachments)
    ? dossierData.attachments
    : [];

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* ── DOSSIER FULL PAGE ────────────────────────────────── */}
      {dossierOpen ? (
        <div className="animate-fade-in">
          {/* Back button */}
          <button
            onClick={closeDossier}
            className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-all"
          >
            ← Back to Cases
          </button>

          {/* Dossier header */}
          <div className="sticky top-0 z-10 bg-[var(--zacc-bg)] pb-4">
            <div className="zacc-surface rounded-2xl px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {isAdmin ? "Case Details" : "Case Dossier"}
                </h3>
                {dossierData && !dossierData.error && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                      {dossierData.reference_code || dossierData.case_id}
                    </code>
                    {!isAdmin && dossierData.reference_code && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(dossierData.reference_code);
                          toast.success("Copied block hash to clipboard!");
                        }}
                        title="Copy reference code"
                        className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 transition-all"
                      >
                        Copy
                      </button>
                    )}
                    <span className="text-slate-400 text-xs">·</span>
                    <span
                      className={`font-bold text-xs ${statusBadge(currentStatus).split(" ")[1]}`}
                    >
                      {statusLabel(currentStatus)}
                    </span>
                    {isAdmin && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase">
                        Read Only
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={closeDossier}
                className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-lg font-black transition-all"
              >
                ×
              </button>
            </div>
          </div>

        </div>
      ) : (
        <>
        {/* Role indicator */}
        <div
          className={`rounded-2xl border p-4 ${isAdmin ? "border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5" : "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10"}`}
        >
        
      </div>

     {/* ── Header & Filters ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isAdmin ? "System Monitoring Dashboard" : "Investigation Pipeline"}
          </h2>
          
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases..."
            className="w-full sm:w-72 px-4 py-2 rounded-xl border border-[var(--zacc-border)] bg-[var(--zacc-card)] text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "Total Cases",
            value: cases.length,
            color: "text-slate-900 dark:text-white",
          },
          {
            label: "Under Review",
            value: cases.filter((c) => c.status === CaseStatus.UNDER_REVIEW)
              .length,
            color: "text-indigo-600 dark:text-indigo-400",
          },
          {
            label: "Investigating",
            value: cases.filter((c) => c.status === CaseStatus.INVESTIGATING)
              .length,
            color: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "High / Critical",
            value: cases.filter(
              (c) => c.priority === "HIGH" || c.priority === "CRITICAL",
            ).length,
            color: "text-rose-600 dark:text-rose-400",
          },
        ].map((s, i) => (
          <div
            key={i}
            className="zacc-surface rounded-2xl p-4"
          >
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {s.label}
            </p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Status Filters ── */}
      <div className="flex flex-wrap gap-2">
        {([
          "ALL",
          ...(isAdmin
            ? Object.values(CaseStatus)
            : Object.values(CaseStatus).filter((s) => s !== CaseStatus.REFERRED)),
        ] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${filter === s ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/25" : "bg-[var(--zacc-card)] border-[var(--zacc-border)] text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-400/40"}`}
          >
            {s === "ALL" ? "All" : statusLabel(s)}
          </button>
        ))}
      </div>

      {/* ── Cases Table ── */}
      <div className="zacc-surface rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-bold text-slate-500">Loading cases...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">
              No cases found
              {filter !== "ALL" ? ` with status "${statusLabel(filter)}"` : ""}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--zacc-card-soft)] border-b border-[var(--zacc-border)]">
                <tr>
                  {[
                    "#",
                    "Case Ref",
                    "Type",
                    "Institution",
                    "Priority",
                    "Status",
                    "Evidence",
                    "Date",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3.5 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredCases.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50/60 dark:hover:bg-blue-500/8 transition-colors"
                  >
                    <td className="px-5 py-4 text-xs text-slate-500 font-bold">
                      {idx + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                          {c.referenceCode || c.id}
                        </code>
                        {c.referenceCode && (
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              navigator.clipboard.writeText(c.referenceCode!); 
                              toast.success("Copied to clipboard!");
                            }}
                            title="Copy tracking code"
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-emerald-500/10 border border-slate-200 dark:border-white/10 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {c.type}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                      {c.institution}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs font-black uppercase ${priorityColor(c.priority)}`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge(c.status)}`}
                      >
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                      {c.attachments_count ?? 0} file{(c.attachments_count ?? 0) === 1 ? "" : "s"}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(c.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDossier(c)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                          isAdmin
                            ? "bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300"
                            : "bg-emerald-500 hover:bg-emerald-600 text-black"
                        }`}
                      >
                        {isAdmin ? "View Details" : "View Dossier"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── Dossier Full Page Content ── */}
      {dossierOpen && (
        <div>
            {dossierLoading ? (
              <div className="py-20 flex flex-col items-center gap-4 text-center">
                <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-slate-500">
                  Loading dossier...
                </p>
              </div>
            ) : dossierData?.error ? (
              <div className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-200 dark:border-rose-500/20">
                <p className="text-rose-700 dark:text-rose-300 font-medium">
                  {dossierData.error}
                </p>
              </div>
            ) : dossierData ? (
                <div className="space-y-6">
                  {/* Case Info */}
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        {
                          label: "Priority",
                          value: dossierData.priority,
                          className:
                            priorityColor(dossierData.priority) +
                            " font-black uppercase",
                        },
                        {
                          label: "Type",
                          value: dossierData.type,
                          className:
                            "font-semibold text-slate-900 dark:text-white",
                        },
                      ].map((f) => (
                        <div key={f.label}>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {f.label}
                          </p>
                          <p className={`text-base ${f.className}`}>
                            {f.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Institution
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {decrypted.institution || dossierData.institution}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Location
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {decrypted.location || dossierData.location || "N/A"}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Description
                          </p>
                          {dossierData.report_language && dossierData.report_language !== 'en' && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/20 uppercase">
                              {getLanguageName(dossierData.report_language)}
                            </span>
                          )}
                        </div>
                        
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {decrypted.description ||
                          dossierData.description ||
                          "No description available."}
                      </p>
                      {translatedText && (
                        <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                              Translated ({getLanguageName(translateLang)})
                            </p>
                            <button
                              onClick={() => setTranslatedText(null)}
                              className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">
                            {translatedText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Case Classification */}
                  {dossierData.ai_summary && (
                    <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                          AI Case Classification
                        </p>
                        {dossierData.ai_summary.confidence != null && (
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/20">
                            {dossierData.ai_summary.confidence}% confidence
                          </span>
                        )}
                      </div>

                      {/* Primary metrics row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {dossierData.ai_summary.urgency && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Urgency</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              dossierData.ai_summary.urgency === 'CRITICAL' ? 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-500/20' :
                              dossierData.ai_summary.urgency === 'HIGH' ? 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-500/20' :
                              dossierData.ai_summary.urgency === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-500/20' :
                              'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/20'
                            }`}>{dossierData.ai_summary.urgency}</span>
                          </div>
                        )}
                        {dossierData.ai_summary.category && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</p>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{dossierData.ai_summary.category}</p>
                            {dossierData.ai_summary.sub_category && (
                              <p className="text-[10px] text-slate-500 mt-0.5">{dossierData.ai_summary.sub_category}</p>
                            )}
                          </div>
                        )}
                        
                      </div>

                      {/* Urgency explanation */}
                      {dossierData.ai_summary.urgency_reason && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-slate-100 dark:border-white/5">
                          {dossierData.ai_summary.urgency_reason}
                        </p>
                      )}

                      {/* Evidence & Pattern row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dossierData.ai_summary.evidence_assessment && (
                          <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Evidence Assessment</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{dossierData.ai_summary.evidence_assessment}</p>
                          </div>
                        )}
                        {dossierData.ai_summary.pattern_indicators && (
                          <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Pattern Analysis</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{dossierData.ai_summary.pattern_indicators}</p>
                          </div>
                        )}
                      </div>

                      {/* Key Findings */}
                      {dossierData.ai_summary.key_findings?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Key Findings</p>
                          <ul className="space-y-1.5">
                            {dossierData.ai_summary.key_findings.map((f: string, i: number) => (
                              <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-white/40 dark:bg-white/5 rounded-lg px-3 py-2">
                                <span className="text-blue-500 mt-0.5 font-bold">{i + 1}.</span> {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommended Actions */}
                      {dossierData.ai_summary.recommended_actions?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Recommended Actions</p>
                          <ul className="space-y-1.5">
                            {dossierData.ai_summary.recommended_actions.map((a: string, i: number) => (
                              <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-100 dark:border-emerald-500/10">
                                <span className="text-emerald-500 mt-0.5 font-bold">→</span> {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Applicable Laws */}
                      {dossierData.ai_summary.applicable_laws?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Applicable Legislation</p>
                          <div className="flex flex-wrap gap-1.5">
                            {dossierData.ai_summary.applicable_laws.map((law: string, i: number) => (
                              <span key={i} className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                                {law}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Impact + Model info footer */}
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pt-2 border-t border-blue-100 dark:border-blue-500/10">
                        {dossierData.ai_summary.estimated_impact && (
                          <p className="text-xs text-slate-500 italic flex-1">
                            <span className="font-bold not-italic text-slate-600 dark:text-slate-400">Impact:</span> {dossierData.ai_summary.estimated_impact}
                          </p>
                        )}
                        {dossierData.ai_summary.model_used && (
                          <p className="text-[9px] text-slate-400 font-mono">
                            Model: {dossierData.ai_summary.model_used}
                            {dossierData.ai_summary.classified_at && ` · ${new Date(dossierData.ai_summary.classified_at).toLocaleString()}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Case Book */}
                  {/* ── Pre-Review Findings Report ── */}
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                          Pre-Review Findings Report
                        </p>
                
                      </div>
                      {!preReviewReport && !preReviewLoading && (
                        <button onClick={() => runPreReviewAnalysis()} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-bold uppercase tracking-wider transition-all">
                          Generate Report
                        </button>
                      )}
                      {/* {preReviewReport && !preReviewReport.error && (
                        <button onClick={() => { setPreReviewReport(null); runPreReviewAnalysis(); }} className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-all">
                          Refresh
                        </button>
                      )} */}
                    </div>

                    {preReviewLoading && (
                      <div className="flex items-center gap-3 py-6 justify-center">
                        <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Analyzing...</p>
                      </div>
                    )}

                    {preReviewReport?.error && (
                      <p className="text-xs text-rose-500 py-2">{preReviewReport.error}</p>
                    )}

                    {preReviewReport && !preReviewReport.error && (() => {
                      const expert = preReviewReport.expert_analysis;
                      const ai = preReviewReport.ai_enhancement;
                      if (!expert) return null;

                      return (
                        <div className="space-y-4">
                          {/* Summary Narrative */}
                          <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4 border border-emerald-100 dark:border-emerald-500/10">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Case Summary</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{ai?.case_narrative || expert.summary}</p>
                          </div>

                          {/* Overall Scores Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 text-center">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Overall Score</p>
                              <p className={`text-2xl font-black ${
                                expert.overall_score >= 75 ? 'text-rose-600 dark:text-rose-400' :
                                expert.overall_score >= 55 ? 'text-orange-600 dark:text-orange-400' :
                                expert.overall_score >= 35 ? 'text-amber-600 dark:text-amber-400' :
                                'text-emerald-600 dark:text-emerald-400'
                              }`}>{expert.overall_score}</p>
                              <p className="text-[9px] text-slate-500">/100</p>
                            </div>
                            <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 text-center">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Urgency</p>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                expert.overall_urgency === 'CRITICAL' ? 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-500/20' :
                                expert.overall_urgency === 'HIGH' ? 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-500/20' :
                                expert.overall_urgency === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/20'
                              }`}>{expert.overall_urgency}</span>
                            </div>
                            <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 text-center">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Evidence</p>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                expert.evidence_assessment?.quality === 'STRONG' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                                expert.evidence_assessment?.quality === 'MODERATE' ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                                'bg-rose-500/10 text-rose-600 border-rose-200'
                              }`}>{expert.evidence_assessment?.quality || 'N/A'}</span>
                            </div>
                          </div>

                          {/* Dimensional Breakdown */}
                          {expert.dimensions && (
                            <div>
                              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Analysis</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(expert.dimensions as Record<string, any>)
                                  .filter(([key]) => key !== "complexity")
                                  .map(([key, dim]: [string, any]) => (
                                  <div key={key} className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-slate-100 dark:border-white/5">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                        {key.replace(/_/g, ' ')}
                                      </p>
                                      <span className={`text-xs font-black ${
                                        dim.score >= 70 ? 'text-rose-600' : dim.score >= 45 ? 'text-amber-600' : dim.score >= 20 ? 'text-blue-600' : 'text-slate-500'
                                      }`}>{dim.score}/100</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${
                                        dim.score >= 70 ? 'bg-rose-500' : dim.score >= 45 ? 'bg-amber-500' : dim.score >= 20 ? 'bg-blue-500' : 'bg-slate-400'
                                      }`} style={{ width: `${dim.score}%` }} />
                                    </div>
                                    {dim.factors?.length > 0 && (
                                      <div className="mt-1.5 space-y-0.5">
                                        {dim.factors.slice(0, 3).map((f: string, i: number) => (
                                          <p key={i} className="text-[9px] text-slate-500 dark:text-slate-500 truncate">• {f}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Red Flags */}
                          {expert.flags?.length > 0 && (
                            <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-xl p-4 border border-rose-100 dark:border-rose-500/10">
                              <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">Red Flags &amp; Concerns</p>
                              <div className="space-y-1.5">
                                {expert.flags.map((f: string, i: number) => (
                                  <div key={i} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                                    <span className="text-rose-500 mt-0.5 font-bold">⚠</span> {f}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Corruption Indicators */}
                          {expert.corruption_indicators?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Detected Corruption Indicators</p>
                              <div className="flex flex-wrap gap-1.5">
                                {expert.corruption_indicators.map((ind: string, i: number) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                                    {ind}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Evidence Assessment */}
                          {expert.evidence_assessment && (
                            <div>
                              <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2">Evidence Assessment</p>
                              {expert.evidence_assessment.file_assessments?.length > 0 && (
                                <div className="space-y-1.5 mb-3">
                                  {expert.evidence_assessment.file_assessments.map((f: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 border border-slate-100 dark:border-white/5">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        f.relevance === 'HIGH' ? 'bg-emerald-500/10 text-emerald-600' :
                                        f.relevance === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600' :
                                        'bg-slate-500/10 text-slate-500'
                                      }`}>{f.relevance}</span>
                                      <span className="font-medium text-slate-700 dark:text-slate-300">{f.file}</span>
                                      <span className="text-slate-500 truncate">— {f.note}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {expert.evidence_assessment.missing_evidence?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Missing Evidence</p>
                                  <ul className="space-y-1">
                                    {expert.evidence_assessment.missing_evidence.map((m: string, i: number) => (
                                      <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5">⚠</span> {m}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Key Claims */}
                          {expert.key_claims?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Key Claims Extracted</p>
                              <ul className="space-y-1.5">
                                {expert.key_claims.map((c: string, i: number) => (
                                  <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-white/40 dark:bg-white/5 rounded-lg px-3 py-2">
                                    <span className="text-indigo-500 mt-0.5 font-bold">{i + 1}.</span> {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* AI Enhancement (if available) */}
                          {ai && (
                            <div className="border-t border-emerald-100 dark:border-emerald-500/10 pt-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">AI-Enhanced Intelligence</p>
                                {ai.confidence != null && (
                                  <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">{ai.confidence}% confidence</span>
                                )}
                              </div>

                              {/* Corruption Pattern */}
                              {ai.corruption_pattern && (
                                <div className="bg-blue-50/50 dark:bg-blue-500/5 rounded-lg p-3 border border-blue-100 dark:border-blue-500/10">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Corruption Pattern</p>
                                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{ai.corruption_pattern.primary_type}</p>
                                  {ai.corruption_pattern.modus_operandi && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{ai.corruption_pattern.modus_operandi}</p>
                                  )}
                                  {ai.corruption_pattern.pattern_analysis && (
                                    <p className="text-xs text-slate-500 mt-1 italic">{ai.corruption_pattern.pattern_analysis}</p>
                                  )}
                                </div>
                              )}

                              {/* AI Evidence Review */}
                              {ai.evidence_review && (
                                <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-slate-100 dark:border-white/5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Evidence Review</p>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      ai.evidence_review.sufficiency_for_prosecution === 'SUFFICIENT' ? 'bg-emerald-500/10 text-emerald-600' :
                                      ai.evidence_review.sufficiency_for_prosecution === 'PARTIAL' ? 'bg-amber-500/10 text-amber-600' :
                                      'bg-rose-500/10 text-rose-600'
                                    }`}>{ai.evidence_review.sufficiency_for_prosecution}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400">{ai.evidence_review.evidence_summary}</p>
                                </div>
                              )}

                              {/* Persons of Interest */}
                              {ai.persons_of_interest?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Persons of Interest</p>
                                  <div className="space-y-1">
                                    {ai.persons_of_interest.map((p: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2 border border-slate-100 dark:border-white/5">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                          p.risk_level === 'HIGH' ? 'bg-rose-500/10 text-rose-600' :
                                          p.risk_level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600' :
                                          'bg-slate-500/10 text-slate-500'
                                        }`}>{p.risk_level}</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{p.name_or_role}</span>
                                        <span className="text-slate-500">— {p.alleged_involvement}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Risk Assessment */}
                              {ai.risk_assessment && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {[
                                    { label: 'Evidence Tampering', value: ai.risk_assessment.evidence_tampering_risk },
                                    { label: 'Suspect Flight', value: ai.risk_assessment.suspect_flight_risk },
                                    { label: 'Ongoing Harm', value: ai.risk_assessment.ongoing_harm_risk },
                                    { label: 'Overall Risk', value: ai.risk_assessment.overall_risk },
                                  ].map((r, i) => (
                                    <div key={i} className="bg-white/50 dark:bg-white/5 rounded-lg p-2 border border-slate-100 dark:border-white/5 text-center">
                                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{r.label}</p>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                        r.value === 'CRITICAL' || r.value === 'HIGH' ? 'bg-rose-500/10 text-rose-600' :
                                        r.value === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600' :
                                        'bg-emerald-500/10 text-emerald-600'
                                      }`}>{r.value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Investigation Strategy */}
                              {ai.investigation_strategy?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Recommended Investigation Strategy</p>
                                  <ol className="space-y-1.5">
                                    {ai.investigation_strategy.map((s: string, i: number) => (
                                      <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-100 dark:border-emerald-500/10">
                                        <span className="text-emerald-600 mt-0.5 font-black text-[10px] min-w-[18px]">{i + 1}.</span> {s}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Applicable Laws */}
                              {ai.applicable_laws?.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Applicable Legislation</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ai.applicable_laws.map((law: string, i: number) => (
                                      <span key={i} className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                                        {law}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {ai.model_used && (
                                <p className="text-[9px] text-slate-400 font-mono pt-1">
                                  AI Model: {ai.model_used}
                                  {ai.ai_generated_at && ` · ${new Date(ai.ai_generated_at).toLocaleString()}`}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Recommendations */}
                          {expert.recommendations?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Recommendations</p>
                              <ul className="space-y-1.5">
                                {expert.recommendations.map((r: string, i: number) => (
                                  <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-white/40 dark:bg-white/5 rounded-lg px-3 py-2">
                                    <span className="text-emerald-500 mt-0.5 font-bold">→</span> {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                      

                         
                        </div>
                      );
                    })()}
                  </div>

                  {/* Case Book — Timeline */}
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        Bookmark: {statusLabel(bookmarkStage)}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {CASE_BOOK_STAGES.map((stage, idx) => {
                        const isPassed = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;
                        const stageRecord = stagesData.find((s: any) => s.stage === stage);

                        return (
                          <div
                            key={stage}
                            className={`rounded-xl border px-3 py-3 min-h-[108px] transition-all ${
                              isCurrent
                                ? "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10"
                                : isPassed
                                  ? "border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900/40 opacity-70"
                                  : "border-slate-200 dark:border-white/10 bg-white dark:bg-black/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p
                                className={`text-[11px] font-black uppercase tracking-wider ${
                                  isPassed
                                    ? "text-slate-500 dark:text-slate-400"
                                    : isCurrent
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : "text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {statusLabel(stage)}
                              </p>
                              <span className="text-xs">
                                {isCurrent ? "🔖" : isPassed ? "🔒" : "📄"}
                              </span>
                            </div>

                            {stageRecord ? (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3">
                                {stageRecord.investigator_notes || "Stage completed."}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                {isPassed ? "Passed and locked" : isCurrent ? "Current stage" : "Pending"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    
                  </div>

                  {/* Evidence Shelf */}
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        Case Evidence
                      </p>
                      <div className="flex items-center gap-2">
                        {caseAttachments.length > 1 && (
                          <button
                            onClick={async () => {
                              const caseId = dossierData?.case_id || dossierData?.id;
                              for (const att of caseAttachments) {
                                const url = att.download_url || `/api/reports/${caseId}/attachments/${att.id}/download`;
                                await downloadEvidence(url, att.original_name || "evidence");
                              }
                              toast.success(`Downloaded ${caseAttachments.length} files`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-bold uppercase tracking-wider transition-all"
                          >
                            Download All
                          </button>
                        )}
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {caseAttachments.length} file{caseAttachments.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {caseAttachments.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">
                        No evidence files attached to this case yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {caseAttachments.map((attachment: any) => {
                          const caseId = dossierData?.case_id || dossierData?.id;
                          const dlUrl = attachment.download_url || `/api/reports/${caseId}/attachments/${attachment.id}/download`;
                          const mime = (attachment.mime_type || "").toLowerCase();
                          const canPreview = mime.startsWith("image/") || mime.startsWith("text/") || mime.includes("json") || mime.includes("csv") || mime.includes("xml") || mime.includes("markdown") || mime.startsWith("video/") || mime.startsWith("audio/");
                          const isActive = previewAttachmentId === String(attachment.id);
                          return (
                          <div key={attachment.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 overflow-hidden">
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span>{attachmentIcon(attachment.mime_type || "")}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {attachment.original_name || "Evidence file"}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {attachment.mime_type || "Unknown type"} · {attachment.size ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB` : "Size unknown"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {canPreview && (
                                  <button
                                    onClick={() => togglePreview(attachment)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                      isActive
                                        ? "bg-blue-500/20 border border-blue-500/40 text-blue-700 dark:text-blue-300"
                                        : "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                                    }`}
                                  >
                                    {isActive ? "Hide" : "Preview"}
                                  </button>
                                )}
                                <button
                                  onClick={() => downloadEvidence(dlUrl, attachment.original_name || "evidence")}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-all"
                                >
                                  Download
                                </button>
                              </div>
                            </div>

                            {/* Inline preview panel */}
                            {isActive && (
                              <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-black/30">
                                {previewLoading ? (
                                  <div className="flex items-center justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="ml-2 text-xs text-slate-500">Loading preview…</span>
                                  </div>
                                ) : previewUrl && mime.startsWith("image/") ? (
                                  <img src={previewUrl} alt={attachment.original_name} className="max-w-full max-h-80 rounded-lg object-contain mx-auto" />
                                ) : previewUrl && mime.startsWith("video/") ? (
                                  <video src={previewUrl} controls className="max-w-full max-h-80 rounded-lg mx-auto" />
                                ) : previewUrl && mime.startsWith("audio/") ? (
                                  <audio src={previewUrl} controls className="w-full" />
                                ) : previewContent ? (
                                  <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto bg-slate-50 dark:bg-black/20 rounded-lg p-3 font-mono leading-relaxed">
                                    {previewContent}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-slate-500 italic py-2">Preview not available for this file type.</p>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Workflow Panel (INVESTIGATORS ONLY) ── */}
                  {!isAdmin && (
                    <>

                      {/* UNDER_REVIEW: validity assessment */}
                      {currentStatus === "UNDER_REVIEW" && (
                        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 p-5 space-y-4">
                          <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">
                            Validity Assessment
                          </p>
                          <p className="text-sm text-indigo-700 dark:text-indigo-300">
                            Review the case and determine whether it is valid
                            and warrants investigation. Provide your assessment
                            report below.
                          </p>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                              Validity Report{" "}
                              <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              rows={4}
                              value={actionNotes}
                              onChange={(e) => setActionNotes(e.target.value)}
                              disabled={actionProcessing}
                              placeholder="State whether the case is valid, your assessment findings, and the basis for your decision (min 10 characters)..."
                              className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-medium"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              {actionNotes.length} characters
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => doAction("INVESTIGATING")}
                              disabled={actionProcessing}
                              className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                              {actionProcessing
                                ? "Processing..."
                                : "Valid — Proceed to Investigation"}
                            </button>
                            <button
                              onClick={() => doAction("CLOSED")}
                              disabled={actionProcessing}
                              className="py-3 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                              {actionProcessing
                                ? "Processing..."
                                : "Invalid — Close Case"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* INVESTIGATING: Detective Investigation Platform */}
                      {currentStatus === "INVESTIGATING" && (
                        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-5 space-y-5">
                          <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                            Detective Investigation Platform
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Conduct the investigation by logging findings from different accounts and sources.
                            Track progress of each line of inquiry before making a final determination.
                          </p>

                          {/* Investigation Log Form */}
                          <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-black/20 p-4 space-y-3">
                            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                              Add Investigation Entry
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Account / Source <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={logEntry.account}
                                  onChange={(e) => setLogEntry(prev => ({...prev, account: e.target.value}))}
                                  placeholder="e.g. Witness A, Bank Records, CCTV Footage..."
                                  className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Progress Status
                                </label>
                                <select
                                  value={logEntry.progress}
                                  onChange={(e) => setLogEntry(prev => ({...prev, progress: e.target.value}))}
                                  className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                                >
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Blocked">Blocked</option>
                                  <option value="Needs Follow-up">Needs Follow-up</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Findings / Notes <span className="text-rose-500">*</span>
                              </label>
                              <textarea
                                rows={3}
                                value={logEntry.finding}
                                onChange={(e) => setLogEntry(prev => ({...prev, finding: e.target.value}))}
                                placeholder="Document what was found from this source, what evidence was collected, and any conclusions..."
                                className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 resize-none"
                              />
                            </div>
                            <button
                              onClick={() => {
                                if (logEntry.account.trim().length < 2 || logEntry.finding.trim().length < 5) {
                                  toast.error("Please fill in both account and findings.");
                                  return;
                                }
                                setInvestigationLogs(prev => [...prev, {
                                  date: new Date().toLocaleString(),
                                  account: logEntry.account.trim(),
                                  finding: logEntry.finding.trim(),
                                  progress: logEntry.progress,
                                }]);
                                setLogEntry({account: "", finding: "", progress: "In Progress"});
                                toast.success("Investigation entry added!");
                              }}
                              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs uppercase tracking-wider transition-all"
                            >
                              + Add Entry
                            </button>
                          </div>

                          {/* Investigation Log Table */}
                          {investigationLogs.length > 0 && (
                            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                              <div className="bg-slate-50 dark:bg-white/5 px-4 py-2 flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                  Investigation Log — {investigationLogs.length} entries
                                </p>
                                <div className="flex gap-2 text-[10px] font-bold">
                                  <span className="text-emerald-600">{investigationLogs.filter(l => l.progress === "Completed").length} completed</span>
                                  <span className="text-amber-600">{investigationLogs.filter(l => l.progress === "In Progress").length} in progress</span>
                                </div>
                              </div>
                              <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-60 overflow-y-auto">
                                {investigationLogs.map((log, idx) => (
                                  <div key={idx} className="px-4 py-3 flex items-start gap-3">
                                    <span className={`mt-0.5 px-2 py-0.5 rounded text-[9px] font-black uppercase whitespace-nowrap ${
                                      log.progress === "Completed" ? "bg-emerald-500/10 text-emerald-600" :
                                      log.progress === "Blocked" ? "bg-rose-500/10 text-rose-600" :
                                      log.progress === "Needs Follow-up" ? "bg-blue-500/10 text-blue-600" :
                                      "bg-amber-500/10 text-amber-600"
                                    }`}>{log.progress}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">{log.account}</p>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{log.finding}</p>
                                      <p className="text-[10px] text-slate-400 mt-1">{log.date}</p>
                                    </div>
                                    <button
                                      onClick={() => setInvestigationLogs(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-slate-400 hover:text-rose-500 text-xs transition-colors flex-shrink-0"
                                      title="Remove entry"
                                    >✕</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Final Investigation Report */}
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                              Final Investigation Report{" "}
                              <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              rows={4}
                              value={actionNotes}
                              onChange={(e) => setActionNotes(e.target.value)}
                              disabled={actionProcessing}
                              placeholder="Summarize your full investigation findings. Include evidence collected, witnesses interviewed, conclusions reached, and your recommendation for the case (min 10 characters)..."
                              className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none font-medium"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              {actionNotes.length} characters
                              {investigationLogs.length > 0 && ` · ${investigationLogs.length} investigation entries will be included in the report`}
                            </p>
                          </div>

                          {showReferralMenu && (
                          <div className="rounded-xl border border-purple-300 dark:border-purple-500/30 bg-white dark:bg-black/20 p-4 space-y-3">
                            <p className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                              Formal Referral Dossier (Required for Referral)
                            </p>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setShowReferralMenu(false)}
                                className="text-[10px] font-bold uppercase tracking-wider text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                              >
                                Hide Referral Form
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Receiving Authority <span className="text-rose-500">*</span>
                                </label>
                                <select
                                  value={referralDraft.authority}
                                  onChange={(e) => setReferralDraft((prev) => ({ ...prev, authority: e.target.value }))}
                                  className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                                >
                                  <option>National Prosecuting Authority (NPA)</option>
                                  <option>Zimbabwe Republic Police (ZRP)</option>
                                  <option>Financial Intelligence Unit (FIU)</option>
                                  <option>Zimbabwe Revenue Authority (ZIMRA)</option>
                                  <option>Auditor-General</option>
                                  <option>Other Competent Authority</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Referral Date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={referralDraft.transmissionDate}
                                  onChange={(e) => setReferralDraft((prev) => ({ ...prev, transmissionDate: e.target.value }))}
                                  className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Referral Reference <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={referralDraft.reference}
                                onChange={(e) => setReferralDraft((prev) => ({ ...prev, reference: e.target.value }))}
                                placeholder="e.g. ZACC/REF/2026/0427-A"
                                className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Legal / Regulatory Basis <span className="text-rose-500">*</span>
                              </label>
                              <textarea
                                rows={3}
                                value={referralDraft.legalBasis}
                                onChange={(e) => setReferralDraft((prev) => ({ ...prev, legalBasis: e.target.value }))}
                                placeholder="Cite relevant legal basis, mandate, and reason for referral."
                                className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500 resize-none"
                              />
                            </div>
                          </div>
                          )}
                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={() => {
                                const fullNotes = investigationLogs.length > 0
                                  ? `${actionNotes}\n\n--- Investigation Log (${investigationLogs.length} entries) ---\n${investigationLogs.map((l, i) => `${i+1}. [${l.progress}] ${l.account}: ${l.finding} (${l.date})`).join('\n')}`
                                  : actionNotes;
                                const original = actionNotes;
                                setActionNotes(fullNotes);
                                doAction("SUCCESSFUL").then(() => setActionNotes(original));
                              }}
                              disabled={actionProcessing}
                              className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                              {actionProcessing
                                ? "Processing..."
                                : "✓ Solved by ZACC"}
                            </button>
                            <button
                              onClick={() => {
                                if (!showReferralMenu) {
                                  const proceed = window.confirm(
                                    "Proceed to refer this case to an external authority? You will need to select the authority and then click Proceed Referral.",
                                  );
                                  if (!proceed) return;
                                  setShowReferralMenu(true);
                                  toast.success("Select the relevant authority, complete referral details, then click Proceed Referral.");
                                  return;
                                }

                                const fullNotes = investigationLogs.length > 0
                                  ? `${actionNotes}\n\n--- Investigation Log (${investigationLogs.length} entries) ---\n${investigationLogs.map((l, i) => `${i+1}. [${l.progress}] ${l.account}: ${l.finding} (${l.date})`).join('\n')}`
                                  : actionNotes;

                                if (referralDraft.reference.trim().length < 3) {
                                  toast.error("Please provide a formal referral reference.");
                                  return;
                                }
                                if (referralDraft.legalBasis.trim().length < 10) {
                                  toast.error("Please provide a valid legal/regulatory basis for referral.");
                                  return;
                                }

                                const original = actionNotes;
                                setActionNotes(fullNotes);
                                doAction("REFERRED", true, {
                                  referral_authority: referralDraft.authority,
                                  referral_legal_basis: referralDraft.legalBasis,
                                  referral_reference: referralDraft.reference,
                                  referral_transmission_date: referralDraft.transmissionDate,
                                }).then(() => setActionNotes(original));
                              }}
                              disabled={actionProcessing}
                              className="py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                              {actionProcessing
                                ? "Processing..."
                                : showReferralMenu
                                ? "Proceed Referral"
                                : "Refer to Other Authority"}
                            </button>
                            <button
                              onClick={() => {
                                const fullNotes = investigationLogs.length > 0
                                  ? `${actionNotes}\n\n--- Investigation Log (${investigationLogs.length} entries) ---\n${investigationLogs.map((l, i) => `${i+1}. [${l.progress}] ${l.account}: ${l.finding} (${l.date})`).join('\n')}`
                                  : actionNotes;
                                const original = actionNotes;
                                setActionNotes(fullNotes);
                                doAction("CLOSED").then(() => setActionNotes(original));
                              }}
                              disabled={actionProcessing}
                              className="py-3 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                              {actionProcessing
                                ? "Processing..."
                                : "Close — Insufficient Evidence"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* REFERRED: handled in Authority Findings page */}
                      {currentStatus === "REFERRED" && (
                        <div className="rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 p-5 space-y-4">
                          <p className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-2">
                            Referred to Other Authorities
                          </p>
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            This case has been formally referred to a competent external authority for legal or regulatory action.
                            All case proceedings and final outcomes for referred cases are now recorded in the Authority Findings page.
                            This dossier is read-only at this stage.
                          </p>

                          {/* Print Referral Report PDF */}
                          <button
                            onClick={() => {
                              const referralStage = stagesData.find((s: any) => s.stage === "REFERRED");
                              if (referralStage) {
                                generateStagePDF(dossierData, referralStage);
                                toast.success("Referral report generated for printing!");
                              } else {
                                toast.error("No referral stage record found.");
                              }
                            }}
                            className="w-full py-3 rounded-xl bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                          >
                            📄 Print Formal Referral Report
                          </button>

                          <div className="border-t border-purple-200 dark:border-purple-500/20 pt-4">
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              Use the Authority Findings page to log external authority proceedings, print table-format reports, and complete this case.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* SUCCESSFUL: Case resolved successfully */}
                      {currentStatus === "SUCCESSFUL" && (
                        <div className="rounded-2xl border border-teal-200 dark:border-teal-500/20 bg-teal-50 dark:bg-teal-500/10 p-5">
                          <p className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest mb-2">
                            Case Resolved Successfully
                          </p>
                          <p className="text-sm text-teal-700 dark:text-teal-300">
                            The receiving authority has acted on this case and the results have been recorded.
                            The case has been successfully concluded with legal action taken.
                          </p>
                        </div>
                      )}

                      {/* CLOSED */}
                      {currentStatus === "CLOSED" && (
                        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-5">
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2">
                            Case Closed
                          </p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            This case has been closed. The whistleblower may
                            file a dispute if they disagree with the outcome.
                          </p>
                        </div>
                      )}

                      {/* DISPUTED */}
                      {currentStatus === "DISPUTED" && (
                        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-5">
                          <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest mb-2">
                            Dispute Filed
                          </p>
                          <p className="text-sm text-rose-700 dark:text-rose-300 mb-3">
                            The whistleblower has disputed the outcome of this case.
                            {dossierData.closed_at_stage && (
                              <span className="block mt-1 font-bold">
                                Case was closed at stage: <span className="text-rose-600 dark:text-rose-300">{statusLabel(dossierData.closed_at_stage)}</span>.
                                You can re-open it at that stage for further review.
                              </span>
                            )}
                          </p>
                          {dossierData.dispute_reason && (
                            <div className="rounded-xl bg-white dark:bg-black/20 border border-rose-200 dark:border-rose-500/20 px-4 py-3 mb-4">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Dispute Statement
                              </p>
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {dossierData.dispute_reason}
                              </p>
                            </div>
                          )}
                          <div className="mt-4">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                              Response / Resolution Notes{" "}
                              <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              rows={3}
                              value={actionNotes}
                              onChange={(e) => setActionNotes(e.target.value)}
                              disabled={actionProcessing}
                              placeholder="Provide your response to the dispute and your decision..."
                              className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 resize-none font-medium"
                            />
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              {dossierData.closed_at_stage && dossierData.closed_at_stage !== "SUBMITTED" && (
                                <button
                                  onClick={() => doAction(dossierData.closed_at_stage)}
                                  disabled={actionProcessing}
                                  className="py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                                >
                                  {actionProcessing
                                    ? "Processing..."
                                    : `Re-open at ${statusLabel(dossierData.closed_at_stage)}`}
                                </button>
                              )}
                              {(!dossierData.closed_at_stage || dossierData.closed_at_stage === "SUBMITTED") && (
                                <button
                                  onClick={() => doAction("UNDER_REVIEW")}
                                  disabled={actionProcessing}
                                  className="py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                                >
                                  {actionProcessing ? "Processing..." : "Re-open for Review"}
                                </button>
                              )}
                              <button
                                onClick={() => doAction("CLOSED")}
                                disabled={actionProcessing}
                                className="py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                              >
                                {actionProcessing
                                  ? "Processing..."
                                  : "Uphold — Close Case"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Admin: read-only status summary */}
                  {isAdmin && (
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-5">
                      <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">
                        Current Status: {statusLabel(currentStatus)}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {currentStatus === "SUBMITTED" &&
                          "This case is awaiting investigator review."}
                        {currentStatus === "UNDER_REVIEW" &&
                          "An investigator is currently assessing the validity of this case."}
                        {currentStatus === "INVESTIGATING" &&
                          "This case is under active investigation."}
                        {currentStatus === "REFERRED" &&
                          "This case has been referred to a competent authority for legal or regulatory action."}
                        {currentStatus === "SUCCESSFUL" &&
                          "This case has been successfully resolved through legal proceedings."}
                        {currentStatus === "CLOSED" &&
                          "This case has been closed."}
                        {currentStatus === "DISPUTED" &&
                          "The whistleblower has disputed the outcome of this case."}
                      </p>
                      {currentStatus === "DISPUTED" &&
                        dossierData.dispute_reason && (
                          <div className="mt-3 rounded-xl bg-white dark:bg-black/20 border border-rose-200 dark:border-rose-500/20 px-4 py-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Dispute Statement
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                              {dossierData.dispute_reason}
                            </p>
                          </div>
                        )}
                    </div>
                  )}


                </div>
              ) : null}
        </div>
      )}
    </div>
  );
};
