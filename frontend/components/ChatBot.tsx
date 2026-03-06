import React, { useState, useRef, useEffect } from "react";

interface Message {
  id: number;
  from: "user" | "bot";
  text: string;
  timestamp: Date;
}

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

const BOT_RESPONSES: { patterns: string[]; response: string }[] = [
  {
    patterns: ["file", "report", "submit", "how to report", "start", "begin", "new report"],
    response: `To file an anonymous report:\n\n1. Click the **File Report** tab at the top\n2. Select the type of corruption\n3. Enter the affected institution and location\n4. Write a detailed description (more detail helps investigators)\n5. Click **Submit Anonymous Report**\n\nNo account, email, or password required. After submitting, you will receive a unique **tracking code** — save it in a safe place!`,
  },
  {
    patterns: ["tracking code", "session code", "reference", "code", "what is"],
    response: `Your **tracking code** (also called a reference code, e.g. ZACC-REF-XXXXXX) is:\n\n• Generated automatically when you file a report\n• The ONLY way to check your case status\n• Not linked to your identity in any way\n• Permanent — keep it somewhere safe\n\nYou can find it on the success screen after submitting, or use it on the **Track Case** tab to check progress.`,
  },
  {
    patterns: ["track", "check status", "case status", "my case", "follow up", "update"],
    response: `To track your case:\n\n1. Click the **Track Case** tab\n2. Enter your tracking code (e.g. ZACC-REF-XXXXXX)\n3. Click **Track Case**\n\nYou will see:\n• Current case status & progress timeline\n• Investigator notes at each stage\n• Option to upload additional evidence\n• Dispute option if your case is closed\n• PDF reports for each stage`,
  },
  {
    patterns: ["safe", "anonymous", "identity", "private", "privacy", "secret", "who knows", "confidential"],
    response: `Your identity is **fully protected** by ZACC's system:\n\n🔒 **Zero personal data collected** — no name, email, or phone\n🔒 **End-to-end encryption** — all case details are encrypted at rest\n🔒 **Blockchain anchoring** — tamper-proof audit trail\n🔒 **Anonymous reports** — not linked to any account\n🔒 **Panic Exit button** — instantly hides what you're doing\n\nNo one at ZACC can identify you through the system. Only your tracking code connects you to your case.`,
  },
  {
    patterns: ["happen", "process", "what next", "after submit", "investigation process", "stages", "steps"],
    response: `After you file a report, it goes through these stages:\n\n1. **Submitted** — Your report is received and encrypted\n2. **Under Review** — An investigator reviews the case validity\n3. **Investigating** — A full investigation is conducted\n4. **Referred** — Case referred to ZACC Review Board (serious cases)\n5. **Closed** — Case concluded with findings\n\nAt every stage, you can view the investigator's notes on your tracking page. If you disagree with a closure, you can **dispute** the decision.`,
  },
  {
    patterns: ["evidence", "attach", "upload", "file", "photos", "documents", "proof", "add more"],
    response: `You can add evidence to your case at any time (while it's not closed):\n\n1. Go to **Track Case** tab and enter your code\n2. Scroll to the **Add Evidence** section\n3. Click to upload files\n\n**Accepted files:**\n• Photos: JPG, PNG, GIF, WebP\n• Videos: MP4, MOV, AVI\n• Audio: MP3, WAV, OGG\n• Documents: PDF, DOC, DOCX, XLS, XLSX, TXT\n\n**Limits:** Max 10 files total · Max 10MB per file`,
  },
  {
    patterns: ["dispute", "disagree", "not satisfied", "appeal", "challenge", "unfair", "wrong decision"],
    response: `If you disagree with a case closure:\n\n1. Go to **Track Case** and enter your code\n2. Scroll to the **Case Closed** section\n3. Click **Dispute This Decision**\n4. Provide a written statement (at least 10 characters) explaining why\n5. Optionally attach supporting evidence\n6. Submit the dispute\n\nYour case will be marked as **Disputed** and reviewed by ZACC management. You will be notified of the outcome through your tracking code.`,
  },
  {
    patterns: ["long", "time", "when", "how long", "days", "weeks", "months", "timeline", "duration"],
    response: `Investigation timelines vary based on case complexity:\n\n• **Simple cases:** 2–4 weeks\n• **Complex cases:** 1–3 months\n• **Referred cases:** 3–6+ months\n\nYou can check real-time updates any time using your tracking code. The **Case Progress** timeline shows which stage your case is in. Cases are prioritised by our expert system based on severity.`,
  },
  {
    patterns: ["zacc", "what is zacc", "organisation", "organization", "commission", "about"],
    response: `**ZACC** is the **Zimbabwe Anti-Corruption Commission** — an independent body established to:\n\n• Combat corruption in public and private sectors\n• Investigate corruption offences\n• Educate the public on corruption prevention\n• Receive and investigate complaints\n\nZACC operates under the Anti-Corruption Commission Act and reports to Parliament. All reports are handled with strict confidentiality.`,
  },
  {
    patterns: ["priority", "urgent", "critical", "high", "severity", "how priority"],
    response: `You no longer need to select a priority — our **Expert System** automatically assigns it based on:\n\n• Type of corruption (embezzlement & procurement fraud rank higher)\n• Keywords in your description (government funds, ministers, etc.)\n• Affected institution (national vs. local)\n• Level of detail provided\n\nPriorities: LOW → MEDIUM → HIGH → CRITICAL\n\nProviding a **detailed, specific description** helps the system assign the correct priority.`,
  },
  {
    patterns: ["pdf", "report", "download", "print", "document"],
    response: `PDF reports are available for each investigation stage:\n\n• On the **Track Case** tab, each stage card has a **PDF Report** button\n• The PDF includes: stage name, investigator notes, date & time\n• Investigator identity is protected in whistleblower PDFs\n\nFor investigators, each stage PDF includes the officer's name, statement, and timestamp — useful for formal documentation.`,
  },
  {
    patterns: ["help", "hi", "hello", "hey", "assist", "guide"],
    response: `Hello! I'm the **ZACC Guide**, here to help you navigate the reporting system.\n\nI can help you with:\n• Filing an anonymous report\n• Understanding tracking codes\n• Adding evidence to your case\n• Disputing a decision\n• Understanding the investigation process\n\nClick one of the quick topics below, or type your question!`,
  },
];

const FALLBACK = `I'm not sure I understand that fully. Here are some things I can help with:\n\n• How to file a report\n• Tracking codes explained\n• Adding evidence\n• Disputing decisions\n• The investigation process\n• Privacy & anonymity\n\nTry clicking a quick topic below, or rephrase your question!`;

function findResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const item of BOT_RESPONSES) {
    if (item.patterns.some(p => lower.includes(p))) {
      return item.response;
    }
  }
  return FALLBACK;
}

function formatBotText(text: string) {
  // Convert **bold** and \n\n newlines to JSX
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className={line === "" ? "mt-2" : "leading-relaxed"}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} className="font-black text-white">{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
      </p>
    );
  });
}

let msgId = 0;

const WELCOME: Message = {
  id: ++msgId,
  from: "bot",
  text: "Hello! I'm the **ZACC Guide**. I can help you understand how to file a report, track your case, add evidence, or dispute a decision.\n\nSelect a topic below or type your question.",
  timestamp: new Date(),
};

export const ChatBot: React.FC = () => {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState("");
  const [typing, setTyping]       = useState(false);
  const [unread, setUnread]       = useState(0);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: ++msgId, from: "user", text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      const reply = findResponse(text.trim());
      const botMsg: Message = { id: ++msgId, from: "bot", text: reply, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
      if (!open) setUnread(p => p + 1);
    }, 700 + Math.random() * 500);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-2xl shadow-emerald-500/40 flex items-center justify-center hover:scale-110 transition-transform"
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
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-8rem))] flex flex-col rounded-3xl border border-white/10 bg-[#080c18] shadow-2xl overflow-hidden animate-fade-in">

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-emerald-800 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🛡️</div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">ZACC Guide</p>
              <p className="text-emerald-200 text-xs">Ask me anything about the system</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.from === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black flex-shrink-0 mt-0.5">Z</div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.from === "user" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white/8 text-slate-300 rounded-bl-sm border border-white/10"}`}>
                  {msg.from === "bot" ? formatBotText(msg.text) : <p>{msg.text}</p>}
                  <p className={`text-[10px] mt-1.5 ${msg.from === "user" ? "text-emerald-200 text-right" : "text-slate-500"}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black flex-shrink-0">Z</div>
                <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick topics */}
          <div className="px-4 py-2 border-t border-white/10 flex-shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {QUICK_TOPICS.map(topic => (
                <button key={topic.key} onClick={() => sendMessage(topic.label)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-[10px] font-bold text-slate-300 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 transition-all whitespace-nowrap">
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
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a question..."
              className="flex-1 bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 min-w-0"
            />
            <button onClick={() => sendMessage(input)} disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black flex items-center justify-center disabled:opacity-40 transition-all flex-shrink-0">
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
};
