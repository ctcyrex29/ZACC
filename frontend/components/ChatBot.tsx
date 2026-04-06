import React, { useState, useRef, useEffect } from "react";
import { apiClient } from "../services/api";

interface Message {
  id: number;
  from: "user" | "bot";
  text: string;
  timestamp: Date;
  attachmentNames?: string[];
}

interface ChatbotApiPayload {
  response?: string;
  source?: "gemini" | "fallback";
  suggestions?: string[];
}

interface ReportDraft {
  type: string;
  institution: string;
  location: string;
  description: string;
  files: File[];
}

const MAX_INPUT_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 20;
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;

const CORRUPTION_TYPES = [
  "Bribery",
  "Procurement Fraud",
  "Abuse of Office",
  "Embezzlement",
  "Nepotism",
  "Other",
];

const QUICK_TOPICS = [
  { label: "How to file a report", key: "file" },
  { label: "What is a tracking code?", key: "tracking_code" },
  { label: "How to track my case", key: "track" },
  { label: "Is my identity safe?", key: "privacy" },
  { label: "What happens after filing?", key: "process" },
  { label: "How to add evidence", key: "evidence" },
  { label: "How to dispute a decision", key: "dispute" },
  { label: "Types of corruption", key: "corruption_types" },
  { label: "What is blockchain verification?", key: "blockchain" },
];

type GuidedPhase =
  | "idle"
  | "confirm_start"
  | "pick_type"
  | "enter_institution"
  | "enter_location"
  | "enter_description"
  | "attach_files"
  | "review"
  | "submitting"
  | "done";

function formatBotText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className={line === "" ? "mt-2" : "leading-relaxed"}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-black text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
      </p>
    );
  });
}

let msgId = 0;

const WELCOME: Message = {
  id: ++msgId,
  from: "bot",
  text: "Hello! I'm the **ZACC Guide** — your AI assistant for navigating the anti-corruption reporting system.\n\nI can help you:\n- **File a report** step by step (right here in this chat!)\n- Understand your tracking code\n- Add evidence or dispute a decision\n- Learn about privacy protections\n\nSelect a topic below or type your question.",
  timestamp: new Date(),
};

export const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "bot"; text: string }[]
  >([]);

  // Guided filing state
  const [phase, setPhase] = useState<GuidedPhase>("idle");
  const [draft, setDraft] = useState<ReportDraft>({
    type: "",
    institution: "",
    location: "",
    description: "",
    files: [],
  });
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const addBotMessage = (text: string) => {
    const botMsg: Message = {
      id: ++msgId,
      from: "bot",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, botMsg]);
    if (!open) setUnread((p) => p + 1);
  };

  const addUserMessage = (text: string, attachmentNames?: string[]) => {
    const userMsg: Message = {
      id: ++msgId,
      from: "user",
      text,
      timestamp: new Date(),
      attachmentNames,
    };
    setMessages((prev) => [...prev, userMsg]);
  };

  /* ---------- Guided filing logic ---------- */

  const startGuidedFiling = () => {
    setDraft({ type: "", institution: "", location: "", description: "", files: [] });
    setSubmittedRef(null);
    setPhase("confirm_start");
    addBotMessage(
      "I'd like to guide you through filing a corruption report. This process is **100% anonymous** — no personal information is collected.\n\nAre you ready to begin?",
    );
  };

  const handleGuidedInput = (text: string) => {
    const lower = text.trim().toLowerCase();

    switch (phase) {
      case "confirm_start": {
        addUserMessage(text);
        if (lower.includes("no") || lower.includes("question")) {
          setPhase("idle");
          setTimeout(() => {
            addBotMessage(
              'No problem! Ask me anything. When you\'re ready to file, just say **"file a report"** or click 🚀 **Guided Filing**.',
            );
            setTyping(false);
          }, 400);
        } else {
          setPhase("pick_type");
          setTimeout(() => {
            addBotMessage(
              "**Step 1 of 5 — Type of Corruption**\n\nWhich type best describes what you witnessed?\n\n" +
                CORRUPTION_TYPES.map((t, i) => `${i + 1}. ${t}`).join("\n"),
            );
            setTyping(false);
          }, 400);
        }
        setTyping(true);
        return true;
      }

      case "pick_type": {
        addUserMessage(text);
        const idx = parseInt(text) - 1;
        const match =
          idx >= 0 && idx < CORRUPTION_TYPES.length
            ? CORRUPTION_TYPES[idx]
            : CORRUPTION_TYPES.find((t) => t.toLowerCase() === lower) ||
              (lower.length > 1 ? text.trim() : null);
        if (!match) {
          addBotMessage(
            "Please pick a number (1-6) or type the corruption type name.",
          );
          return true;
        }
        setDraft((d) => ({ ...d, type: match }));
        setPhase("enter_institution");
        setTyping(true);
        setTimeout(() => {
          addBotMessage(
            `✅ Type: **${match}**\n\n**Step 2 of 5 — Institution**\n\nName the government ministry, department, or organization involved.\n\nExample: "Ministry of Finance", "Harare City Council"`,
          );
          setTyping(false);
        }, 400);
        return true;
      }

      case "enter_institution": {
        addUserMessage(text);
        if (text.trim().length < 2) {
          addBotMessage("Please provide the institution name (at least 2 characters).");
          return true;
        }
        setDraft((d) => ({ ...d, institution: text.trim() }));
        setPhase("enter_location");
        setTyping(true);
        setTimeout(() => {
          addBotMessage(
            `✅ Institution: **${text.trim()}**\n\n**Step 3 of 5 — Location**\n\nWhere did this happen? Province or city name.\n\nType **skip** if you prefer not to specify.`,
          );
          setTyping(false);
        }, 400);
        return true;
      }

      case "enter_location": {
        addUserMessage(text);
        const loc = lower === "skip" ? "" : text.trim();
        setDraft((d) => ({ ...d, location: loc }));
        setPhase("enter_description");
        setTyping(true);
        setTimeout(() => {
          addBotMessage(
            `✅ Location: **${loc || "Not specified"}**\n\n**Step 4 of 5 — Description**\n\nPlease describe what happened in detail. Include:\n- What you witnessed or know\n- Approximate dates\n- People involved (titles/positions)\n- Amounts of money (if known)\n\n**More detail = higher investigation priority.** (Minimum 20 characters)`,
          );
          setTyping(false);
        }, 400);
        return true;
      }

      case "enter_description": {
        addUserMessage(text);
        if (text.trim().length < 20) {
          addBotMessage(
            "The description needs at least **20 characters** to help investigators. Please provide more detail.",
          );
          return true;
        }
        setDraft((d) => ({ ...d, description: text.trim() }));
        setPhase("attach_files");
        setTyping(true);
        setTimeout(() => {
          addBotMessage(
            `✅ Description recorded.\n\n**Step 5 of 5 — Evidence (Optional)**\n\nYou can attach up to **${MAX_FILES} files** (photos, documents, audio, video — max ${MAX_FILE_SIZE_MB}MB each).\n\nClick the 📎 button below to attach files, or type **skip** to proceed without attachments.`,
          );
          setTyping(false);
        }, 400);
        return true;
      }

      case "attach_files": {
        if (lower === "skip" || lower === "no" || lower === "none" || lower === "done") {
          addUserMessage(text);
          showReview();
          return true;
        }
        // If they type something else, remind them
        addUserMessage(text);
        addBotMessage(
          "Use the 📎 button to select files, or type **skip** to proceed without attachments.",
        );
        return true;
      }

      case "review": {
        addUserMessage(text);
        if (lower === "yes" || lower === "submit" || lower.includes("confirm")) {
          submitReport();
        } else if (lower === "no" || lower === "cancel" || lower.includes("start over")) {
          setPhase("idle");
          setDraft({ type: "", institution: "", location: "", description: "", files: [] });
          addBotMessage("Report cancelled. Say **file a report** any time to start again.");
        } else if (lower.includes("edit")) {
          setPhase("pick_type");
          setTyping(true);
          setTimeout(() => {
            addBotMessage(
              "Let's redo it. **Step 1 — Type of Corruption:**\n\n" +
                CORRUPTION_TYPES.map((t, i) => `${i + 1}. ${t}`).join("\n"),
            );
            setTyping(false);
          }, 400);
        } else {
          addBotMessage(
            "Please reply **yes** to submit, **edit** to change details, or **cancel** to discard.",
          );
        }
        return true;
      }

      default:
        return false;
    }
  };

  const showReview = () => {
    setPhase("review");
    setTyping(true);
    const fileInfo =
      draft.files.length > 0
        ? `📎 **${draft.files.length} file(s):** ${draft.files.map((f) => f.name).join(", ")}`
        : "📎 No attachments";

    setTimeout(() => {
      addBotMessage(
        `**Review Your Report**\n\n` +
          `🏷️ **Type:** ${draft.type}\n` +
          `🏛️ **Institution:** ${draft.institution}\n` +
          `📍 **Location:** ${draft.location || "Not specified"}\n` +
          `📝 **Description:** ${draft.description.length > 120 ? draft.description.slice(0, 120) + "…" : draft.description}\n` +
          `${fileInfo}\n\n` +
          `Ready to submit? Reply **yes**, **edit**, or **cancel**.`,
      );
      setTyping(false);
    }, 400);
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errors.push(`"${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      } else if (draft.files.length + validFiles.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed.`);
        break;
      } else {
        validFiles.push(f);
      }
    }

    if (validFiles.length > 0) {
      setDraft((d) => ({ ...d, files: [...d.files, ...validFiles] }));
      addUserMessage(
        `Attached ${validFiles.length} file(s)`,
        validFiles.map((f) => f.name),
      );
      addBotMessage(
        `📎 **${validFiles.length} file(s) attached** (${draft.files.length + validFiles.length}/${MAX_FILES} total).\n\nAttach more, or type **done** to review your report.`,
      );
    }
    if (errors.length > 0) {
      addBotMessage("⚠️ " + errors.join(" "));
    }
  };

  const submitReport = async () => {
    setPhase("submitting");
    setTyping(true);
    addBotMessage("Submitting your report securely… Please wait.");

    try {
      const res = await apiClient.createAnonymousReport({
        type: draft.type,
        institution: draft.institution,
        location: draft.location || undefined,
        description: draft.description,
      });

      const refCode = res?.data?.reference_code || res?.reference_code;
      const priority = res?.data?.priority || res?.priority;

      // Upload files if any
      if (draft.files.length > 0 && refCode) {
        try {
          await apiClient.uploadEvidence(refCode, draft.files);
        } catch {
          // Files failed but report succeeded — inform user
          addBotMessage(
            `⚠️ Report submitted but file upload encountered an issue. You can upload evidence later using your tracking code in the **Track Case** section.`,
          );
        }
      }

      setSubmittedRef(refCode);
      setPhase("done");
      setTyping(false);
      addBotMessage(
        `🎉 **Report Submitted Successfully!**\n\n` +
          `📋 **Your Tracking Code:**\n**${refCode}**\n\n` +
          `${priority ? `⚡ Priority: **${priority}**\n\n` : ""}` +
          `⚠️ **SAVE THIS CODE** — it's the only way to check your case!\n\n` +
          `With this code you can:\n` +
          `- Track your case status\n` +
          `- Upload additional evidence\n` +
          `- Dispute a decision\n\n` +
          `Is there anything else I can help you with?`,
      );
      setDraft({ type: "", institution: "", location: "", description: "", files: [] });
    } catch (err: any) {
      setPhase("review");
      setTyping(false);
      const errMsg = err?.message || "Unknown error";
      addBotMessage(
        `❌ **Submission failed:** ${errMsg}\n\nPlease try again. Reply **yes** to retry or **cancel** to discard.`,
      );
    }
  };

  /* ---------- General chat ---------- */

  const sendMessage = async (text: string) => {
    if (!text.trim() || typing) return;
    const normalized = text.trim().slice(0, MAX_INPUT_LENGTH);

    // If we're in a guided phase, handle it there
    if (phase !== "idle" && phase !== "done") {
      handleGuidedInput(normalized);
      return;
    }

    // Check for filing triggers
    const lower = normalized.toLowerCase();
    if (
      lower.includes("file a report") ||
      lower.includes("guide me") ||
      lower.includes("guided filing") ||
      lower.includes("submit a report") ||
      lower.includes("start over") ||
      lower === "file" ||
      lower === "report"
    ) {
      addUserMessage(normalized);
      startGuidedFiling();
      return;
    }

    // Normal AI-powered chat
    addUserMessage(normalized);
    setTyping(true);

    const newHistory = [
      ...conversationHistory,
      { role: "user" as const, text: normalized },
    ].slice(-MAX_HISTORY_LENGTH);

    try {
      const response = await apiClient.chatbotMessage(normalized, newHistory);
      const payload = (response?.data || {}) as ChatbotApiPayload;
      const botText = payload.response || getFallbackResponse(normalized);
      const updatedHistory = [
        ...newHistory,
        { role: "bot" as const, text: botText },
      ].slice(-MAX_HISTORY_LENGTH);

      setUsingFallback(payload.source === "fallback");
      setDynamicSuggestions(
        Array.isArray(payload.suggestions) ? payload.suggestions.slice(0, 3) : [],
      );
      setConversationHistory(updatedHistory);
      addBotMessage(botText);
    } catch {
      const fallback = getFallbackResponse(normalized);
      setUsingFallback(true);
      setDynamicSuggestions([]);
      setConversationHistory([
        ...newHistory,
        { role: "bot" as const, text: fallback },
      ]);
      addBotMessage(fallback);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
      setInput("");
    }
  };

  /* ---------- Phase-aware option buttons ---------- */

  const getPhaseOptions = (): string[] => {
    switch (phase) {
      case "confirm_start":
        return ["Yes, let's begin", "I have questions first"];
      case "pick_type":
        return CORRUPTION_TYPES;
      case "attach_files":
        return draft.files.length > 0 ? ["Done", "Skip"] : ["Skip"];
      case "review":
        return ["Yes", "Edit", "Cancel"];
      case "done":
        return ["File another report", "How to track my case"];
      default:
        return [];
    }
  };

  const phaseOptions = getPhaseOptions();
  const isFilingActive = phase !== "idle" && phase !== "done";
  const showFileButton = phase === "attach_files";

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Floating button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-2xl shadow-emerald-500/40 flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Open ZACC Guide"
      >
        <span className="text-2xl">{open ? "✕" : "💬"}</span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-50 w-[min(400px,calc(100vw-2rem))] h-[min(600px,calc(100vh-8rem))] flex flex-col rounded-3xl border border-white/10 bg-[#080c18] shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-emerald-800 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
              🛡️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">ZACC Guide</p>
              <p className="text-emerald-200 text-xs">
                {isFilingActive
                  ? "📝 Filing a Report…"
                  : "AI-Powered Whistleblower Assistant"}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          </div>

          {/* Filing progress bar */}
          {isFilingActive && (
            <div className="px-5 py-2 bg-black/40 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-1">
                {["Type", "Institution", "Location", "Description", "Files"].map(
                  (step, i) => {
                    const phaseOrder: GuidedPhase[] = [
                      "pick_type",
                      "enter_institution",
                      "enter_location",
                      "enter_description",
                      "attach_files",
                    ];
                    const currentIdx = phaseOrder.indexOf(phase);
                    const isDone = i < currentIdx || phase === "review" || phase === "submitting";
                    const isCurrent = i === currentIdx;
                    return (
                      <React.Fragment key={step}>
                        <div
                          className={`flex-1 h-1.5 rounded-full transition-all ${isDone ? "bg-emerald-500" : isCurrent ? "bg-emerald-500/50" : "bg-white/10"}`}
                        />
                      </React.Fragment>
                    );
                  },
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">
                {phase === "pick_type" && "Step 1/5 — Corruption Type"}
                {phase === "enter_institution" && "Step 2/5 — Institution"}
                {phase === "enter_location" && "Step 3/5 — Location"}
                {phase === "enter_description" && "Step 4/5 — Description"}
                {phase === "attach_files" && "Step 5/5 — Attach Evidence"}
                {phase === "review" && "Review & Submit"}
                {phase === "submitting" && "Submitting…"}
                {phase === "confirm_start" && "Getting Started"}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.from === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black flex-shrink-0 mt-0.5">
                    Z
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.from === "user" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white/8 text-slate-300 rounded-bl-sm border border-white/10"}`}
                >
                  {msg.from === "bot" ? (
                    formatBotText(msg.text)
                  ) : (
                    <>
                      <p>{msg.text}</p>
                      {msg.attachmentNames && msg.attachmentNames.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.attachmentNames.map((name, i) => (
                            <p
                              key={i}
                              className="text-[11px] text-emerald-200 flex items-center gap-1"
                            >
                              📎 {name}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <p
                    className={`text-[10px] mt-1.5 ${msg.from === "user" ? "text-emerald-200 text-right" : "text-slate-500"}`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black flex-shrink-0">
                  Z
                </div>
                <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Phase option buttons */}
          {phaseOptions.length > 0 && !typing && (
            <div className="px-4 py-2 border-t border-white/10 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {phaseOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      if (phase !== "idle" && phase !== "done") {
                        handleGuidedInput(opt);
                      } else {
                        sendMessage(opt);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick topics (only when idle / done) */}
          {!isFilingActive && (
            <div className="px-4 py-2 border-t border-white/10 flex-shrink-0">
              {usingFallback && (
                <p className="mb-2 text-[10px] text-amber-300">
                  AI service is temporarily unavailable. Using built-in responses.
                </p>
              )}
              <div
                className="flex gap-1.5 overflow-x-auto pb-1"
                style={{ scrollbarWidth: "none" }}
              >
                {dynamicSuggestions.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => sendMessage(topic)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-200 hover:bg-amber-500/25 transition-all whitespace-nowrap"
                  >
                    {topic}
                  </button>
                ))}
                <button
                  onClick={() => startGuidedFiling()}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all whitespace-nowrap"
                >
                  🚀 File a Report
                </button>
                {QUICK_TOPICS.map((topic) => (
                  <button
                    key={topic.key}
                    onClick={() => sendMessage(topic.label)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-[10px] font-bold text-slate-300 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 transition-all whitespace-nowrap"
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submitted ref code copy banner */}
          {submittedRef && phase === "done" && (
            <div className="px-4 py-2 bg-emerald-900/40 border-t border-emerald-500/20 flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-emerald-300 font-black flex-1 truncate">
                📋 {submittedRef}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(submittedRef);
                  addBotMessage("✅ Tracking code copied to clipboard!");
                }}
                className="px-3 py-1 rounded-lg bg-emerald-500/30 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/40 transition-all"
              >
                Copy
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 px-4 py-3 border-t border-white/10 bg-black/20 flex-shrink-0">
            {showFileButton && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-slate-300 flex items-center justify-center transition-all flex-shrink-0"
                title="Attach files"
              >
                📎
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              maxLength={MAX_INPUT_LENGTH}
              placeholder={
                phase === "enter_description"
                  ? "Describe what happened…"
                  : phase === "attach_files"
                    ? "Type 'done' or attach files…"
                    : "Type a question…"
              }
              className="flex-1 bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-w-0"
            />
            <button
              onClick={() => {
                sendMessage(input);
                setInput("");
              }}
              disabled={!input.trim() || typing}
              className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black flex items-center justify-center disabled:opacity-40 transition-all flex-shrink-0"
            >
              ↑
            </button>
          </div>
          <div className="px-4 pb-2 flex justify-between text-[10px] text-slate-500">
            <span>
              {draft.files.length > 0
                ? `📎 ${draft.files.length} file(s) attached`
                : ""}
            </span>
            <span>
              {input.length}/{MAX_INPUT_LENGTH}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Client-side fallback when AI is unavailable
 */
function getFallbackResponse(input: string): string {
  const lower = input.toLowerCase();

  const responses: { patterns: string[]; response: string }[] = [
    {
      patterns: ["file", "report", "submit", "how to report", "start", "new report", "make a report"],
      response:
        'You can file an anonymous corruption report **right here in this chat!**\n\nJust say **"file a report"** or click the 🚀 **File a Report** button below.\n\nI\'ll guide you through 5 simple steps:\n1. Type of corruption\n2. Institution involved\n3. Location\n4. Detailed description\n5. Optional evidence files\n\n**No account, email, or personal info required.** You\'ll receive a unique **tracking code** — save it securely!',
    },
    {
      patterns: ["track", "check status", "case status", "my case", "follow up", "update", "progress", "code"],
      response:
        "To track your case:\n\n1. Click the **Track Case** tab\n2. Enter your tracking code (e.g., ZACC-REF-XXXXXX)\n3. Click **Track Case**\n\nYou'll see:\n- 📊 Current case status and stage\n- 📅 Timeline and progress through investigation\n- 📝 Investigator notes at each stage\n- 📎 Option to upload additional evidence\n- ⚖️ Option to dispute a closure\n\nIf you've lost your tracking code, you'll need to file a new report (for anonymity, codes can't be recovered).",
    },
    {
      patterns: ["safe", "anonymous", "identity", "private", "privacy", "secret", "confidential", "protect"],
      response:
        "Your identity is **completely protected** through multiple layers:\n\n🔒 **Zero personal data** — no name, email, or phone collected\n🔐 **AES-256 encryption** — military-grade encryption for all case data\n⛓️ **Blockchain anchoring** — tamper-proof, verifiable record\n🕵️ **Anonymous by design** — reports aren't linked to any account\n🚪 **Panic Exit** — instantly hides the page if someone approaches\n\nEven ZACC investigators cannot identify who filed an anonymous report. You are safe.",
    },
    {
      patterns: ["evidence", "attach", "upload", "photos", "documents", "proof", "files"],
      response:
        'You can attach evidence while filing or add it later:\n\n**During filing:** Say **"file a report"** — Step 5 lets you attach files\n**After filing:** Go to **Track Case** → enter your code → **Add Evidence**\n\n📷 Photos: JPG, PNG\n🎥 Videos: MP4, MOV\n🎙️ Audio: MP3, WAV\n📄 Documents: PDF, DOC, XLS, TXT\n\n**Limits:** Up to 5 files, 10MB each\n\n💡 **Best evidence:** Screenshots of communications, financial records, photos of documents, audio/video recordings. Even partial evidence helps investigators!',
    },
    {
      patterns: ["dispute", "disagree", "appeal", "challenge", "unfair", "not satisfied", "reopen"],
      response:
        "If you disagree with a case closure:\n\n1. Go to **Track Case** and enter your code\n2. Scroll to the **Case Closed** section\n3. Click **Dispute This Decision**\n4. Write a detailed statement explaining why you disagree\n5. Optionally attach new evidence\n6. Submit\n\nYour case will be marked **DISPUTED** and ZACC management will conduct a fresh review. Disputes are taken seriously — they ensure accountability.",
    },
    {
      patterns: ["brib", "corrupt", "fraud", "embezzl", "nepotism", "abuse", "steal", "theft", "procurement"],
      response:
        'It sounds like you may have witnessed corruption. ZACC investigates:\n\n🏷️ **Bribery** — giving/receiving money for official action\n📦 **Procurement Fraud** — rigged tenders, inflated contracts\n👔 **Abuse of Office** — misusing position for personal gain\n💰 **Embezzlement** — stealing public funds\n👨‍👩‍👦 **Nepotism** — favouring relatives in hiring or contracts\n\n**To make your report impactful, include:**\n- What happened and when\n- Job titles/positions involved\n- Which institution or department\n- Financial amounts (even estimates)\n\nSay **"file a report"** and I\'ll guide you through it!',
    },
    {
      patterns: ["stage", "investigation", "process", "what happens", "timeline", "how long", "after"],
      response:
        "The ZACC investigation process:\n\n📥 **Submitted** — AI expert system classifies priority automatically\n🔍 **Under Review** — Investigator assigned, initial assessment\n🕵️ **Investigating** — Active evidence gathering and analysis\n📋 **Referred** — May be sent to National Prosecuting Authority\n✅ **Closed** — Case resolved with documented findings\n\nHigher-priority cases (more detail, more evidence) are investigated faster. You can track progress anytime with your tracking code.",
    },
    {
      patterns: ["blockchain", "verify", "hash", "tamper", "integrity"],
      response:
        "Your report is protected by **blockchain verification**:\n\n⛓️ A unique SHA-256 hash (digital fingerprint) is created from your report\n📦 This hash is recorded on an immutable blockchain ledger\n🔍 Any tampering would change the hash, instantly revealing modification\n\nThis means your report **cannot be altered or deleted** by anyone — providing an independent, verifiable audit trail that protects both whistleblowers and the integrity of investigations.",
    },
    {
      patterns: ["help", "hi", "hello", "hey", "guide", "good morning", "good afternoon"],
      response:
        'Hello! I\'m the **ZACC Guide** — your AI-powered anti-corruption assistant. 🛡️\n\nI can help you:\n- 📝 **File a corruption report** (say "file a report")\n- 🔍 **Track your case** with a tracking code\n- 📎 **Submit evidence** to strengthen your case\n- ⚖️ **Dispute a decision** you disagree with\n- 🔒 **Understand your protections** and anonymity\n- 📚 **Learn about corruption types** and the investigation process\n\nWhat would you like help with?',
    },
    {
      patterns: ["shona", "ndebele", "tonga", "language", "chivanhu"],
      response:
        "Ndinogona kukubatsira muShona, Ndebele, English, kana Tonga! 🇿🇼\n\nNyora mubvunzo wako mumutauro waunoda!\n\nI can assist in English, Shona, Ndebele, or Tonga — just write in your preferred language and I'll respond in the same language.",
    },
  ];

  for (const item of responses) {
    if (item.patterns.some((p) => lower.includes(p))) return item.response;
  }

  return 'I\'m the **ZACC Guide**, your anti-corruption assistant. I can help with:\n\n- 📝 **Filing a report** — say "file a report" to start\n- 🔍 **Tracking a case** — ask about tracking\n- 📎 **Submitting evidence** — ask about evidence\n- ⚖️ **Disputing a decision** — ask about disputes\n- 🔒 **Privacy & security** — ask about anonymity\n- 📚 **Investigation process** — ask about stages\n\nTry asking a specific question or click a topic button below!';
}
