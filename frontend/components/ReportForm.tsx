import React, { useState, useRef, useCallback } from "react";
import { analyzeCase } from "../services/gemini";
import { apiClient } from "../services/api";
import { CorruptionType, User } from "../types";

interface ReportFormProps {
  user: User;
  onSuccess: () => void;
}

// Zimbabwe provinces and cities for location type-ahead
const LOCATIONS = [
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Gweru",
  "Kwekwe",
  "Kadoma",
  "Masvingo",
  "Chinhoyi",
  "Marondera",
  "Norton",
  "Chegutu",
  "Bindura",
  "Beitbridge",
  "Hwange",
  "Victoria Falls",
  "Kariba",
  "Karoi",
  "Chiredzi",
  "Zvishavane",
  "Shurugwi",
  "Rusape",
  "Chipinge",
  "Redcliff",
  "Plumtree",
  "Lupane",
  "Gokwe",
  "Bikita",
  "Gutu",
  // Provinces
  "Harare Province",
  "Bulawayo Province",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo Province",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands",
  // Districts
  "Epworth",
  "Ruwa",
  "Goromonzi",
  "Seke",
  "Mazowe",
  "Shamva",
  "Mvurwi",
  "Concession",
  "Chivhu",
  "Macheke",
  "Headlands",
  "Nyanga",
  "Chimanimani",
  "Buhera",
  "Murambinda",
  "Inyanga",
  "Penhalonga",
  "Mhangura",
  "Banket",
  "Raffingora",
  "Tengwe",
  "Zvimba",
];

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

const fileIcon = (type: string) => {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("pdf")) return "📄";
  return "📎";
};

export const ReportForm: React.FC<ReportFormProps> = ({ user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: CorruptionType.BRIBERY,
    institution: "",
    location: "",
    description: "",
  });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [submittedReport, setSubmittedReport] = useState<any>(null);
  const [evidenceUploadNotice, setEvidenceUploadNotice] = useState<string | null>(null);

  // Evidence upload
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location type-ahead
  const [locationQuery, setLocationQuery] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);

  // Language hint
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  // ── Location type-ahead ──
  const handleLocationChange = useCallback((value: string) => {
    setLocationQuery(value);
    setFormData((prev) => ({ ...prev, location: value }));

    if (value.trim().length >= 2) {
      const lower = value.toLowerCase();
      const matches = LOCATIONS.filter((loc) =>
        loc.toLowerCase().includes(lower),
      );
      setFilteredLocations(matches.slice(0, 8));
      setShowLocationDropdown(matches.length > 0);
    } else {
      setFilteredLocations([]);
      setShowLocationDropdown(false);
    }
  }, []);

  const selectLocation = (loc: string) => {
    setLocationQuery(loc);
    setFormData((prev) => ({ ...prev, location: loc }));
    setShowLocationDropdown(false);
  };

  // ── File handling ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of selected) {
      if (files.length + valid.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed.`);
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" exceeds 10MB limit.`);
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`"${file.name}" is not a supported file type.`);
        continue;
      }
      valid.push(file);
    }

    setFiles((prev) => [...prev, ...valid]);
    setFileErrors(errors);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileErrors([]);
  };

  // ── Language detection (simple heuristic for Shona/Ndebele) ──
  const detectLanguage = (text: string) => {
    const lower = text.toLowerCase();
    const shonaMarkers = [
      "ndakabira",
      "ndakaona",
      "kuti",
      "kana",
      "zvekuita",
      "nyaya",
      "munhu",
      "zvakaitika",
      "mari",
      "hukama",
      "kushandisa",
      "hurumende",
      "mukuru",
      "basa",
      "chiremba",
      "nguva",
    ];
    const ndebeleMarkers = [
      "ngabona",
      "ukuthi",
      "umuntu",
      "imali",
      "umsebenzi",
      "uhulumende",
      "inkosi",
      "isikolo",
      "indaba",
    ];

    const shonaHits = shonaMarkers.filter((m) => lower.includes(m)).length;
    const ndebeleHits = ndebeleMarkers.filter((m) => lower.includes(m)).length;

    if (shonaHits >= 2) return "Shona";
    if (ndebeleHits >= 2) return "Ndebele";
    return null;
  };

  const handleDescriptionChange = (text: string) => {
    setFormData((prev) => ({ ...prev, description: text }));
    if (text.length > 30) {
      const lang = detectLanguage(text);
      setDetectedLanguage(lang);
    } else {
      setDetectedLanguage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.description.trim().length < 20) {
      setError("Description must be at least 20 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const analysis = await analyzeCase(formData.description);

      const response = await apiClient.createReport({
        type: analysis.category || formData.type,
        institution: formData.institution,
        location: formData.location,
        description: formData.description,
        risk_score: analysis.riskScore || 50,
      });

      if (response.success) {
        setAiAnalysis(analysis);
        setSubmittedReport(response.data);

        // Upload evidence files if any
        if (files.length > 0 && response.data.reference_code) {
          try {
            await apiClient.uploadEvidence(response.data.reference_code, files);
            setEvidenceUploadNotice(
              `${files.length} evidence file${files.length === 1 ? "" : "s"} uploaded and linked to this case file.`,
            );
          } catch {
            setEvidenceUploadNotice(
              "Report submitted, but evidence upload failed. You can upload files later using your tracking code in Track Case.",
            );
          }
        } else {
          setEvidenceUploadNotice(null);
        }
      } else {
        throw new Error(response.message || "Failed to submit report");
      }

      setLoading(false);
    } catch (err: any) {
      console.error("Error submitting report:", err);
      setError(err.message || "Failed to submit report. Please try again.");
      setLoading(false);
    }
  };

  if (aiAnalysis && submittedReport) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="rounded-3xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 text-5xl">
              ✓
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-emerald-900 dark:text-emerald-100 mb-3">
              Report Submitted Successfully
            </h2>
            <p className="text-emerald-800 dark:text-emerald-200 max-w-md mx-auto leading-relaxed">
              Your case has been securely logged and is now in the investigation
              queue.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-white/30 dark:bg-white/5 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Category
              </p>
              <p className="text-sm font-black text-emerald-900 dark:text-white">
                {submittedReport.type}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Expert Priority
              </p>
              <p
                className={`text-sm font-black uppercase ${submittedReport.priority === "CRITICAL" ? "text-rose-600 dark:text-rose-400" : submittedReport.priority === "HIGH" ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {submittedReport.priority}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Risk Score
              </p>
              <p className="text-sm font-black text-emerald-900 dark:text-white">
                {submittedReport.risk_score}%
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
                Evidence
              </p>
              <p className="text-sm font-black text-emerald-900 dark:text-white">
                {files.length} file{files.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-black/20 rounded-2xl p-6 mb-8 border border-emerald-200 dark:border-emerald-500/20">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-3">
              Your Tracking Code
            </p>
            <div className="flex items-center justify-between gap-4">
              <code className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {submittedReport.reference_code}
              </code>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(submittedReport.reference_code)
                }
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-all"
              >
                Copy
              </button>
            </div>
          </div>

          {evidenceUploadNotice && (
            <div className="rounded-2xl p-4 mb-8 border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {evidenceUploadNotice}
              </p>
            </div>
          )}

          <div className="bg-white/20 dark:bg-white/5 rounded-2xl p-6 mb-8 border border-emerald-200/30 dark:border-white/10">
            <h3 className="font-bold text-emerald-900 dark:text-white mb-4">
              What Happens Next
            </h3>
            <ol className="space-y-3 text-sm text-emerald-800 dark:text-emerald-100">
              <li className="flex gap-3">
                <span className="font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  1.
                </span>
                <span>
                  Our team reviews your submission and conducts an initial
                  assessment.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  2.
                </span>
                <span>
                  You can track progress using your tracking code in the "Track
                  Case" section.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  3.
                </span>
                <span>
                  Investigators will update status within 48-72 hours.
                </span>
              </li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setAiAnalysis(null);
                setSubmittedReport(null);
                setEvidenceUploadNotice(null);
                setFiles([]);
                setFileErrors([]);
                setLocationQuery("");
                setDetectedLanguage(null);
                setFormData({
                  type: CorruptionType.BRIBERY,
                  institution: "",
                  location: "",
                  description: "",
                });
              }}
              className="flex-1 px-6 py-4 rounded-xl bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 text-emerald-900 dark:text-white font-bold text-sm uppercase tracking-wider transition-all border border-emerald-200 dark:border-white/10"
            >
              File Another Report
            </button>
            <button
              onClick={onSuccess}
              className="flex-1 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider transition-all"
            >
              View My Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-8 md:p-10">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
            File a Report
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            Provide detailed information about the integrity concern. All
            submissions are encrypted and protected. You can write in any
            language — English, Shona, Ndebele, or Tonga.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-5 rounded-2xl border border-rose-300 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 animate-fade-in">
            <p className="text-rose-700 dark:text-rose-300 text-sm font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Category and Institution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                Type of Corruption
              </label>
              <select
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as CorruptionType,
                  })
                }
              >
                {Object.values(CorruptionType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                Affected Institution
              </label>
              <input
                type="text"
                placeholder="Ministry, department, or company"
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
                value={formData.institution}
                onChange={(e) =>
                  setFormData({ ...formData, institution: e.target.value })
                }
                required
              />
            </div>
          </div>

          {/* Description with language detection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
                Detailed Description
              </label>
              {detectedLanguage && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Detected: {detectedLanguage}
                </span>
              )}
            </div>
            <textarea
              rows={6}
              placeholder="Describe what happened in detail. Include dates, names of positions/titles (not your own), amounts, and any witnesses or evidence. You can write in English, Shona, Ndebele, or any language you are comfortable with..."
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 font-medium leading-relaxed focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all resize-none"
              value={formData.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              required
            />
            <div className="flex items-center justify-between">
              <p
                className={`text-xs font-medium ml-1 ${formData.description.length < 20 ? "text-slate-500 dark:text-slate-600" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {formData.description.length} characters (minimum 20 required)
              </p>
              {formData.description.length >= 20 &&
                formData.description.length < 250 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Tip: More detail = higher priority from the expert system
                  </p>
                )}
            </div>
          </div>

          {/* Location with type-ahead */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
              Location (District/Province)
            </label>
            <input
              type="text"
              placeholder="Start typing a city or province (e.g., Harare, Bulawayo, Masvingo)"
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
              value={locationQuery}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => {
                if (locationQuery.length >= 2 && filteredLocations.length > 0)
                  setShowLocationDropdown(true);
              }}
              onBlur={() =>
                setTimeout(() => setShowLocationDropdown(false), 200)
              }
            />
            {/* Location suggestions dropdown */}
            {showLocationDropdown && filteredLocations.length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1020] shadow-xl max-h-52 overflow-y-auto">
                {filteredLocations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => selectLocation(loc)}
                    className="w-full text-left px-5 py-3 text-sm text-slate-900 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors font-medium border-b border-slate-100 dark:border-white/5 last:border-0"
                  >
                    <span className="mr-2 text-emerald-500">📍</span>
                    {loc}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 ml-1">
              Type to search or enter a custom location if not listed
            </p>
          </div>

          {/* Evidence Upload */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block ml-1">
              Upload Evidence (Optional)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-all"
            >
              <div className="text-3xl mb-2">📎</div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Click to upload evidence files
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Photos, videos, audio, documents — max 10 files, 10MB each
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                JPG, PNG, MP4, MOV, MP3, WAV, PDF, DOC, DOCX, XLS, XLSX, TXT
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* File errors */}
            {fileErrors.length > 0 && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-3">
                {fileErrors.map((err, i) => (
                  <p
                    key={i}
                    className="text-xs text-rose-600 dark:text-rose-400 font-medium"
                  >
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </p>
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{fileIcon(file.type)}</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs font-black hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Info */}
          <div className="p-5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
            <p className="text-xs text-slate-700 dark:text-slate-400 font-medium flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <span>
                Your report is encrypted with RSA-2048 and the case priority is
                assigned by the expert system for fairness and consistency.
              </span>
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-400 font-medium flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <span>
                Write in any language — English, Shona, Ndebele, Tonga — your
                report will be processed and credited fully.
              </span>
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || formData.description.trim().length < 20}
            className={`w-full rounded-2xl font-bold py-4 text-sm uppercase tracking-widest transition-all ${
              loading || formData.description.trim().length < 20
                ? "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : (
              `Submit Secure Report${files.length > 0 ? ` with ${files.length} Evidence File${files.length !== 1 ? "s" : ""}` : ""}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
