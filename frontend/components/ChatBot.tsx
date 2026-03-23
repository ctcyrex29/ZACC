import React, { useState, useRef, useEffect } from "react";
import { apiClient } from "../services/api";

interface Message {
  id: number;
  from: "user" | "bot";
  text: string;
  timestamp: Date;
}

interface ChatbotApiPayload {
  response?: string;
  source?: "gemini" | "fallback";
  suggestions?: string[];
}

const MAX_INPUT_LENGTH = 1000;
const MAX_HISTORY_LENGTH = 20;

const QUICK_TOPICS = [
  { label: "How to file a report", key: "file" },
  { label: "What is a tracking code?", key: "tracking_code" },
  { label: "How to track my case", key: "track" },
  { label: "Is my identity safe?", key: "privacy" },
  { label: "What happens after filing?", key: "process" },
  { label: "How to add evidence", key: "evidence" },
  { label: "How to dispute a decision", key: "dispute" },
  { label: "How long does it take?", key: "timeline" },
];

const GUIDED_STEPS = [
  {
    id: "welcome",
    message:
      "I'd like to guide you through filing a corruption report. This process is **100% anonymous** — no personal information is collected.\n\nAre you ready to begin?",
    options: ["Yes, guide me", "I have questions first"],
  },
  {
    id: "step1",
    message:
      "**Step 1: Choose the type of corruption**\n\nWhich type best describes what you witnessed?\n\n1. Bribery\n2. Procurement Fraud\n3. Abuse of Office\n4. Embezzlement\n5. Nepotism\n6. Other",
    options: [
      "Bribery",
      "Procurement Fraud",
      "Abuse of Office",
      "Embezzlement",
      "Nepotism",
      "Other",
    ],
  },
  {
    id: "step2",
    message:
      '**Step 2: Identify the institution**\n\nPlease name the government ministry, department, or organization involved. For example: "Ministry of Finance", "Harare City Council", "ZRP Headquarters".',
    options: [],
  },
  {
    id: "step3",
    message:
      "**Step 3: Location**\n\nWhere did this take place? Province or city name helps investigators.",
    options: [],
  },
  {
    id: "step4",
    message:
      "**Step 4: Describe what happened**\n\nPlease provide as much detail as possible. Include:\n- What you witnessed or know\n- When it happened (approximate dates)\n- Who was involved (titles/positions, not names of whistleblowers)\n- Amounts of money if known\n\nMore detail = higher investigation priority.",
    options: [],
  },
  {
    id: "complete",
    message:
      "You now have all the information needed to file your report. Click the **File Report** tab at the top of the page to submit.\n\nAfter submitting, you'll receive a **tracking code** — save it! That's your only way to check on your case.\n\nAnything else I can help with?",
    options: ["How to track my case", "Tell me about privacy", "Start over"],
  },
];

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
  text: "Hello! I'm the **ZACC Guide** — your AI assistant for navigating the anti-corruption reporting system.\n\nI can help you:\n- File a report step by step\n- Understand your tracking code\n- Add evidence or dispute a decision\n- Learn about privacy protections\n\nSelect a topic below or type your question.",
  timestamp: new Date(),
};

export const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [guidedStep, setGuidedStep] = useState<number>(-1);
  const [usingFallback, setUsingFallback] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "bot"; text: string }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || typing) return;
    const normalized = text.trim().slice(0, MAX_INPUT_LENGTH);

    const userMsg: Message = {
      id: ++msgId,
      from: "user",
      text: normalized,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Check for guided flow triggers
    if (
      normalized.toLowerCase() === "yes, guide me" ||
      normalized.toLowerCase() === "start over"
    ) {
      setUsingFallback(false);
      setGuidedStep(1);
      setTimeout(() => {
        addBotMessage(GUIDED_STEPS[1].message);
        setTyping(false);
      }, 600);
      return;
    }

    if (normalized.toLowerCase() === "i have questions first") {
      setUsingFallback(false);
      setGuidedStep(-1);
      setTimeout(() => {
        addBotMessage(
          "Of course! Ask me anything about the process. When you're ready to file, just say **\"guide me\"** and I'll walk you through it step by step.",
        );
        setTyping(false);
      }, 600);
      return;
    }

    // If in guided mode, advance steps
    if (guidedStep >= 1 && guidedStep < GUIDED_STEPS.length - 1) {
      setUsingFallback(false);
      const nextStep = guidedStep + 1;
      setGuidedStep(nextStep);
      setTimeout(() => {
        addBotMessage(GUIDED_STEPS[nextStep].message);
        setTyping(false);
      }, 600);
      return;
    }

    // Check for "guide me" in any message
    if (normalized.toLowerCase().includes("guide me")) {
      setUsingFallback(false);
      setGuidedStep(0);
      setTimeout(() => {
        addBotMessage(GUIDED_STEPS[0].message);
        setTyping(false);
      }, 600);
      return;
    }

    // Normal AI-powered chat
    const newHistory = [...conversationHistory, { role: "user", text: normalized }].slice(
      -MAX_HISTORY_LENGTH,
    );

    try {
      const response = await apiClient.chatbotMessage(normalized, newHistory);
      const payload = (response?.data || {}) as ChatbotApiPayload;
      const botText = payload.response || getFallbackResponse(normalized);
      const updatedHistory = [...newHistory, { role: "bot", text: botText }].slice(
        -MAX_HISTORY_LENGTH,
      );

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
      setConversationHistory([...newHistory, { role: "bot", text: fallback }]);
      addBotMessage(fallback);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Options buttons for guided mode
  const currentStepOptions =
    guidedStep >= 0 && guidedStep < GUIDED_STEPS.length
      ? GUIDED_STEPS[guidedStep].options
      : [];

  return (
    <>
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
        <div className="fixed bottom-24 left-4 sm:left-6 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-8rem))] flex flex-col rounded-3xl border border-white/10 bg-[#080c18] shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-emerald-800 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
              🛡️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">ZACC Guide</p>
              <p className="text-emerald-200 text-xs">
                AI-Powered Whistleblower Assistant
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
          </div>

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
                    <p>{msg.text}</p>
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
                    ></div>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Guided step options */}
          {currentStepOptions.length > 0 && (
            <div className="px-4 py-2 border-t border-white/10 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {currentStepOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => sendMessage(opt)}
                    className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick topics */}
          <div className="px-4 py-2 border-t border-white/10 flex-shrink-0">
            {usingFallback && (
              <p className="mb-2 text-[10px] text-amber-300">
                AI service is temporarily unavailable. The guide is using trusted built-in responses.
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
                onClick={() => sendMessage("Guide me through filing a report")}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all whitespace-nowrap"
              >
                🚀 Guided Filing
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

          {/* Input */}
          <div className="flex gap-2 px-4 py-3 border-t border-white/10 bg-black/20 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              maxLength={MAX_INPUT_LENGTH}
              placeholder="Type a question..."
              className="flex-1 bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-w-0"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black flex items-center justify-center disabled:opacity-40 transition-all flex-shrink-0"
            >
              ↑
            </button>
          </div>
          <div className="px-4 pb-3 text-right text-[10px] text-slate-500">
            {input.length}/{MAX_INPUT_LENGTH}
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
      patterns: [
        "file",
        "report",
        "submit",
        "how to report",
        "start",
        "new report",
      ],
      response:
        "To file an anonymous report:\n\n1. Click the **File Report** tab at the top\n2. Select the type of corruption\n3. Enter the affected institution and location\n4. Write a detailed description\n5. Click **Submit Anonymous Report**\n\nNo account required. You'll receive a **tracking code** — save it!",
    },
    {
      patterns: [
        "track",
        "check status",
        "case status",
        "my case",
        "follow up",
      ],
      response:
        "To track your case:\n\n1. Click the **Track Case** tab\n2. Enter your tracking code (e.g. ZACC-REF-XXXXXX)\n3. Click **Track Case**\n\nYou'll see status, timeline, investigator notes, and options to upload evidence or dispute.",
    },
    {
      patterns: [
        "safe",
        "anonymous",
        "identity",
        "private",
        "privacy",
        "secret",
      ],
      response:
        "Your identity is **fully protected**:\n\n- Zero personal data collected\n- End-to-end encryption\n- Blockchain anchoring\n- Panic Exit button for safety\n\nNo one at ZACC can identify you through the system.",
    },
    {
      patterns: [
        "evidence",
        "attach",
        "upload",
        "photos",
        "documents",
        "proof",
      ],
      response:
        "Upload evidence via the **Track Case** tab. Accepted: photos, videos, audio, documents. Max 10 files, 10MB each.",
    },
    {
      patterns: ["dispute", "disagree", "appeal", "challenge"],
      response:
        "To dispute a closed case: go to **Track Case**, enter your code, scroll to the closure section, click **Dispute This Decision**, and provide your reasoning.",
    },
    {
      patterns: ["help", "hi", "hello", "hey", "guide"],
      response:
        "Hello! I'm the **ZACC Guide**. I can help with filing reports, tracking cases, adding evidence, disputing decisions, and understanding the process. What would you like to know?",
    },
  ];

  for (const item of responses) {
    if (item.patterns.some((p) => lower.includes(p))) return item.response;
  }

  return "I can help with:\n\n- Filing a report\n- Tracking codes\n- Adding evidence\n- Disputing decisions\n- Privacy protections\n\nTry clicking a topic button or rephrase your question!";
}
