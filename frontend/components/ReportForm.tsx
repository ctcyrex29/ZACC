
import React, { useState } from 'react';
import { analyzeCase } from '../services/gemini';
import { apiClient } from '../services/api';
import { CorruptionType, User, CaseStatus, CaseReport } from '../types';

interface ReportFormProps {
  user: User;
  onSuccess: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({ user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: CorruptionType.BRIBERY,
    institution: '',
    location: '',
    description: '',
  });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [submittedReport, setSubmittedReport] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.description.trim().length < 20) {
      setError('Description must be at least 20 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Get AI analysis first
      const analysis = await analyzeCase(formData.description);
      
      // Submit to backend API
      const response = await apiClient.createReport({
        type: analysis.category || formData.type,
        institution: formData.institution,
        location: formData.location,
        description: formData.description,
        priority: analysis.priority || 'MEDIUM',
        risk_score: analysis.riskScore || 50,
      });

      if (response.success) {
        setAiAnalysis(analysis);
        setSubmittedReport(response.data);
      } else {
        throw new Error(response.message || 'Failed to submit report');
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error submitting report:', err);
      setError(err.message || 'Failed to submit report. Please try again.');
      setLoading(false);
    }
  };


  if (aiAnalysis && submittedReport) {
    return (
      <div className="glass-card p-10 md:p-16 rounded-5xl text-center max-w-4xl mx-auto animate-fade-in">
        <div className="w-20 h-20 bg-nexus-emerald/10 text-nexus-emerald rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl soft-glow">
          ✓
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Submission Received</h2>
        <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed mb-12">
          Your report has been securely logged. Our system has performed an initial automated assessment.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Category</p>
            <p className="text-sm font-bold text-white truncate">{submittedReport.type}</p>
          </div>
          <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Priority</p>
            <p className="text-sm font-bold text-white">{submittedReport.priority}</p>
          </div>
          <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Risk Score</p>
            <p className="text-sm font-bold text-white">{submittedReport.risk_score}%</p>
          </div>
          <div className="bg-nexus-accent/20 p-5 rounded-3xl border border-nexus-accent/20">
            <p className="text-[10px] text-nexus-accent font-bold uppercase tracking-wider mb-2">Stage</p>
            <p className="text-sm font-bold text-white">SUBMITTED</p>
          </div>
        </div>

        <div className="bg-nexus-950/60 p-8 rounded-4xl border border-white/5 text-left mb-12">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold text-nexus-emerald uppercase tracking-widest mb-2">Tracking Code</p>
              <p className="text-2xl font-bold text-white font-mono tracking-wider">{submittedReport.reference_code}</p>
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(submittedReport.reference_code)}
              className="px-6 py-3 bg-white/5 text-white rounded-xl text-xs font-bold hover:bg-white/10"
            >
              Copy Code
            </button>
          </div>
          <p className="mt-6 text-xs text-slate-500 leading-relaxed font-medium">
            Save this code to track your report progress. ZACC investigators will review the evidence provided and update the status within 48-72 hours.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => { setAiAnalysis(null); setSubmittedReport(null); setFormData({ type: CorruptionType.BRIBERY, institution: '', location: '', description: '' }); }}
            className="flex-1 px-8 py-4 bg-white/5 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all"
          >
            New Report
          </button>
          <button 
            onClick={onSuccess}
            className="flex-1 px-8 py-4 bg-nexus-emerald text-nexus-950 rounded-2xl font-bold text-sm hover:bg-emerald-400 transition-all soft-glow"
          >
            Go to My Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-10 md:p-12 rounded-5xl max-w-4xl mx-auto">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-3">Incident Report Portal</h2>
        <p className="text-slate-500 font-medium">Please provide as much detail as possible. Your submission is protected by ZACC's anonymity protocols.</p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
          <p className="text-rose-400 text-sm font-bold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Type of Corruption</label>
            <select 
              className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value as CorruptionType})}
            >
              {Object.values(CorruptionType).map(t => <option key={t} value={t} className="bg-nexus-900">{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Affected Institution</label>
            <input 
              type="text" 
              placeholder="Name of Ministry, Department or Firm"
              className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all"
              value={formData.institution}
              onChange={e => setFormData({...formData, institution: e.target.value})}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Description of Incident</label>
          <textarea 
            rows={6}
            placeholder="Describe what happened, including dates, names (if known), and any other relevant facts..."
            className="w-full p-6 rounded-2xl border border-white/10 text-white font-medium leading-relaxed focus:border-nexus-emerald/40 outline-none transition-all"
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Location (District/Province)</label>
            <input 
              type="text" 
              placeholder="e.g. Harare South"
              className="w-full p-4 rounded-xl border border-white/10 text-white font-medium focus:border-nexus-emerald/40 outline-none transition-all"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Evidence / Attachments</label>
            <div className="relative group">
              <input 
                type="file" 
                className="w-full p-3.5 rounded-xl border-2 border-dashed border-white/5 bg-white/5 text-slate-500 text-xs font-bold file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-nexus-900 file:text-nexus-emerald file:font-bold cursor-pointer hover:border-nexus-emerald/20 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all ${
              loading 
                ? 'bg-white/5 text-slate-600' 
                : 'bg-nexus-emerald text-nexus-950 hover:bg-emerald-400 soft-glow'
            }`}
          >
            {loading ? 'Processing Information...' : 'Send Secure Report'}
          </button>
          <p className="mt-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Identity shielding protocol active • End-to-end encrypted
          </p>
        </div>
      </form>
    </div>
  );
};
