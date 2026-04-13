import React, { useState } from "react";

const HELP_SECTIONS = [
  {
    icon: "📝",
    title: "How to File a Report",
    steps: [
      'Click "Report Case" from the menu or public portal.',
      "Select the type of corruption (Bribery, Fraud, etc.).",
      "Enter the institution and location involved.",
      "Describe what happened in detail — dates, people, amounts.",
      "Attach any evidence: photos, documents, audio, or video.",
      "Submit — you'll receive a unique tracking code. Save it!",
    ],
  },
  {
    icon: "🔍",
    title: "How to Track Your Case",
    steps: [
      'Go to "Track Case" on the public portal or your dashboard.',
      "Enter your tracking code (e.g., ZACC-REF-XXXXXX).",
      "View your case status, timeline, and investigator notes.",
      "You can also upload additional evidence from the tracking page.",
    ],
  },
  {
    icon: "🔒",
    title: "Your Privacy & Safety",
    steps: [
      "No personal information is collected — fully anonymous.",
      "All data is encrypted with AES-256 military-grade encryption.",
      "Reports are anchored on blockchain for tamper-proof integrity.",
      "Even investigators cannot identify anonymous reporters.",
    ],
  },
  {
    icon: "📎",
    title: "Submitting Evidence",
    steps: [
      "You can attach up to 5 files (max 10MB each) when filing.",
      "Supported: images, videos, audio, PDFs, Word, Excel, text files.",
      "You can also add evidence later via the Track Case page.",
      "Best evidence: screenshots, financial records, communications.",
    ],
  },
  {
    icon: "⚖️",
    title: "Disputing a Decision",
    steps: [
      "If your case is closed and you disagree, you can dispute it.",
      "Go to Track Case → enter your code → click 'Dispute This Decision'.",
      "Write a detailed statement explaining why you disagree.",
      "Attach any new evidence that supports your dispute.",
      "ZACC management will conduct a fresh review of your case.",
    ],
  },
  {
    icon: "📊",
    title: "Investigation Process",
    steps: [
      "Submitted — Your report is classified by priority automatically.",
      "Under Review — An investigator is assigned for initial assessment.",
      "Investigating — Active evidence gathering and analysis.",
      "Referred — May be sent to courts or law enforcement.",
      "Successful / Closed — Case resolved with documented findings.",
    ],
  },
];

export const HelpGuide: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed bottom-6 left-4 sm:left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-110 transition-transform"
        title="Filing Help Guide"
      >
        <span className="text-2xl">{open ? "✕" : "❓"}</span>
      </button>

      {/* Help panel */}
      {open && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-50 w-[min(400px,calc(100vw-2rem))] max-h-[min(600px,calc(100vh-8rem))] flex flex-col rounded-3xl border border-white/10 bg-[#080c18] shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-emerald-800 flex-shrink-0">
            <img
              src="/zacc-logo.png"
              alt="ZACC"
              className="w-9 h-9 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">ZACC Help Guide</p>
              <p className="text-emerald-200 text-xs">
                How to use the reporting system
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0">
            {HELP_SECTIONS.map((section, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedIndex(isExpanded ? null : idx)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-lg flex-shrink-0">
                      {section.icon}
                    </span>
                    <span className="flex-1 text-sm font-bold text-slate-200">
                      {section.title}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <ol className="space-y-2 ml-2">
                        {section.steps.map((step, sIdx) => (
                          <li
                            key={sIdx}
                            className="flex gap-2 text-sm text-slate-400 leading-relaxed"
                          >
                            <span className="text-emerald-400 font-black flex-shrink-0">
                              {sIdx + 1}.
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Extra tip */}
            <div className="mt-3 px-4 py-3 rounded-2xl bg-emerald-900/30 border border-emerald-500/20">
              <p className="text-xs text-emerald-300 font-bold mb-1">
                💡 Quick Tip
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                The more detail you provide in your report — dates, names, amounts,
                locations — the faster investigators can act. Even partial
                information helps!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
