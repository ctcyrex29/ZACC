
import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { User, CaseReport, CaseStatus } from '../types';
import BlockchainVerification from './BlockchainVerification';

interface CaseTrackingProps {
  user: User;
}

export const CaseTracking: React.FC<CaseTrackingProps> = ({ user }) => {
  const [cases, setCases] = useState<CaseReport[]>([]);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getReports();
      
      if (response.success) {
        // Map API response to match frontend types
        const mappedCases = response.data.map((report: any) => ({
          id: report.case_id,
          timestamp: report.created_at,
          type: report.type,
          description: report.description,
          location: report.location,
          institution: report.institution,
          status: report.status,
          riskScore: report.risk_score,
          priority: report.priority,
          reporterId: report.user_id,
          referenceCode: report.reference_code,
          disputeReason: report.dispute_reason,
          lastUpdated: report.last_updated,
          blockchain_tx_hash: report.blockchain_tx_hash,
          blockchain_block_number: report.blockchain_block_number,
        }));
        setCases(mappedCases);
      } else {
        throw new Error(response.message || 'Failed to load reports');
      }
    } catch (err: any) {
      console.error('Error loading cases:', err);
      setError(err.message || 'Failed to load your reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [user.id]);

  const handleDispute = async (caseId: string) => {
    if (!reason.trim() || reason.length < 10) {
      alert("Please provide a more detailed reason (minimum 10 characters) for the dispute.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Find the report ID from the case_id
      const report = cases.find(c => c.id === caseId);
      if (!report) {
        throw new Error('Report not found');
      }

      const response = await apiClient.disputeReport(caseId, reason);
      
      if (response.success) {
        setDisputingId(null);
        setReason('');
        await loadCases(); // Reload cases to get updated data
      } else {
        throw new Error(response.message || 'Failed to submit dispute');
      }
    } catch (err: any) {
      console.error('Error submitting dispute:', err);
      alert(err.message || 'Failed to submit dispute. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stages = [
    { key: CaseStatus.SUBMITTED, label: 'Submitted', icon: '📥' },
    { key: CaseStatus.UNDER_REVIEW, label: 'Reviewing', icon: '🔎' },
    { key: CaseStatus.INVESTIGATING, label: 'Action', icon: '⚡' },
    { key: CaseStatus.REFERRED, label: 'Legal', icon: '⚖️' },
    { key: CaseStatus.CLOSED, label: 'Closed', icon: '✅' },
  ];

  const getStatusIndex = (status: CaseStatus) => {
    if (status === CaseStatus.DISPUTED) return 2; // Show it back at 'Action' stage
    return stages.findIndex(s => s.key === status);
  };

  if (loading) {
    return (
      <div className="glass-card p-16 rounded-5xl text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8 animate-pulse">📊</div>
        <h2 className="text-2xl font-bold text-white mb-4">Loading your reports...</h2>
        <p className="text-slate-500 font-medium">Please wait while we fetch your data.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-16 rounded-5xl text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8">⚠️</div>
        <h2 className="text-2xl font-bold text-white mb-4">Error Loading Reports</h2>
        <p className="text-slate-500 font-medium mb-8">{error}</p>
        <button 
          onClick={loadCases}
          className="bg-nexus-emerald text-nexus-950 px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all soft-glow"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="glass-card p-16 rounded-5xl text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8 opacity-40">📊</div>
        <h2 className="text-2xl font-bold text-white mb-4">No submissions yet</h2>
        <p className="text-slate-500 font-medium leading-relaxed max-w-xs mx-auto mb-10">
          When you report an incident, it will appear here so you can monitor its progress in real-time.
        </p>
        <button className="bg-nexus-emerald text-nexus-950 px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all soft-glow">
          Create My First Report
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="bg-nexus-emerald/10 border border-nexus-emerald/10 p-10 rounded-4xl flex items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">My Submissions</h2>
          <p className="text-slate-400 font-medium">Tracking {cases.length} active investigation pipeline{cases.length > 1 ? 's' : ''}.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-nexus-950/40 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-nexus-emerald animate-pulse"></div>
          <span className="text-[10px] font-bold text-nexus-emerald uppercase tracking-widest">Active Sync</span>
        </div>
      </div>

      <div className="grid gap-6">
        {cases.map((c) => (
          <div key={c.id} className={`glass-card p-8 rounded-4xl transition-all duration-300 border ${c.status === CaseStatus.DISPUTED ? 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.05)]' : 'hover:border-nexus-emerald/20'}`}>
            <div className="flex flex-col md:flex-row gap-8 mb-10">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">{c.id}</h3>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                    c.status === CaseStatus.DISPUTED 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                      : 'bg-white/5 text-slate-400 border-white/5'
                  }`}>
                    {c.status.replace('_', ' ')}
                  </span>
                  {c.status === CaseStatus.DISPUTED && (
                    <span className="text-[10px] font-bold text-rose-400 animate-pulse uppercase tracking-widest">⚠️ Unsolved / Re-triggered</span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                  {c.institution} • {new Date(c.timestamp).toLocaleDateString()}
                </p>
                <div className="p-5 bg-nexus-950/40 rounded-2xl border border-white/5">
                  <p className="text-sm text-slate-400 leading-relaxed font-medium italic">"{c.description}"</p>
                </div>
              </div>

              <div className="md:w-48 text-right shrink-0">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Tracking Code</p>
                <p className="font-mono font-bold text-nexus-emerald bg-nexus-emerald/5 border border-nexus-emerald/10 px-4 py-2 rounded-xl text-lg tracking-tight inline-block">
                  {c.referenceCode}
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5">
              <div className="relative flex justify-between items-center px-2">
                <div className="absolute left-6 right-6 h-0.5 bg-white/5 top-1/2 -translate-y-1/2 z-0 rounded-full" />
                <div 
                  className={`absolute left-6 h-1 top-1/2 -translate-y-1/2 z-0 transition-all duration-700 ease-in-out rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] ${
                    c.status === CaseStatus.DISPUTED ? 'bg-rose-500 shadow-rose-500/30' : 'bg-nexus-emerald'
                  }`} 
                  style={{ width: `calc(${(getStatusIndex(c.status) / (stages.length - 1)) * 100}% - 12px)` }}
                />
                
                {stages.map((s, idx) => {
                  const isActive = idx <= getStatusIndex(c.status);
                  const isCurrent = s.key === c.status || (c.status === CaseStatus.DISPUTED && s.key === CaseStatus.INVESTIGATING);
                  return (
                    <div key={s.key} className="relative z-10 flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-500 ${
                        isCurrent ? (c.status === CaseStatus.DISPUTED ? 'bg-rose-500 text-white scale-125 ring-4 ring-rose-500/10' : 'bg-nexus-emerald text-nexus-950 scale-125 soft-glow ring-4 ring-nexus-emerald/10') :
                        isActive ? 'bg-nexus-emerald/10 border border-nexus-emerald/20 text-nexus-emerald' : 'bg-nexus-950 border border-white/5 text-slate-700'
                      }`}>
                        {c.status === CaseStatus.DISPUTED && s.key === CaseStatus.INVESTIGATING ? '⚠️' : s.icon}
                      </div>
                      <p className={`text-[9px] font-bold uppercase mt-4 tracking-widest text-center transition-colors ${
                        isCurrent ? 'text-white' :
                        isActive ? 'text-nexus-emerald' : 'text-slate-700'
                      }`}>
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Blockchain Verification Section */}
              <BlockchainVerification reportId={c.id} />

              {/* Dispute Input Section (Shown when CLOSED) */}
              {c.status === CaseStatus.CLOSED && (
                <div className="mt-10 p-6 bg-rose-500/5 rounded-3xl border border-rose-500/10 animate-fade-in overflow-hidden transition-all duration-500">
                  {disputingId === c.id ? (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Reason for Resolution Dispute</label>
                        <span className={`text-[9px] font-bold ${reason.length >= 10 ? 'text-emerald-500' : 'text-slate-500'}`}>
                          {reason.length} / 10 characters minimum
                        </span>
                      </div>
                      <textarea 
                        className="w-full bg-nexus-950 border border-rose-500/20 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-all placeholder:text-slate-700"
                        placeholder="Explain why you believe this case was handled incorrectly or if you suspect foul play by investigators..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        disabled={isSubmitting}
                      />
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleDispute(c.id)}
                          disabled={isSubmitting || reason.length < 10}
                          className="flex-1 py-4 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Processing Dispute...
                            </>
                          ) : 'Submit Formal Dispute & Re-trigger Audit'}
                        </button>
                        <button 
                          onClick={() => { setDisputingId(null); setReason(''); }}
                          disabled={isSubmitting}
                          className="px-8 py-4 bg-white/5 text-slate-400 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="text-left flex-1">
                        <h4 className="text-sm font-black text-white mb-2 flex items-center gap-2">
                          <span className="text-rose-500">🛡️</span>
                          Is this resolution unsatisfactory?
                        </h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-lg">
                          If you have evidence that this case was not solved properly, or if you suspect internal interference, you have the right to challenge the outcome.
                        </p>
                      </div>
                      <button 
                        onClick={() => setDisputingId(c.id)}
                        className="whitespace-nowrap px-8 py-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all group"
                      >
                        Challenge Outcome
                        <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Prominent Dispute Reason Display (Shown when DISPUTED) */}
              {c.status === CaseStatus.DISPUTED && (
                <div className="mt-8 p-8 bg-gradient-to-br from-rose-500/10 to-transparent rounded-[32px] border border-rose-500/20 shadow-xl shadow-rose-500/5 animate-fade-in relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-6xl">🚨</div>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">🚨</div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-[0.1em] leading-none">Formal Integrity Dispute Active</h4>
                      <p className="text-[10px] text-rose-400 font-black uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        Status: Re-triggered for Oversight Audit
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="p-6 bg-nexus-950/80 rounded-2xl border border-rose-500/10 backdrop-blur-xl relative">
                       <p className="text-[9px] font-black text-rose-400/80 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                         Whistleblower's Statement of Contention
                         <span className="text-slate-600 font-bold tracking-normal italic">Verified Transmission</span>
                       </p>
                       <p className="text-base text-slate-100 leading-relaxed font-semibold italic">
                         "{c.disputeReason}"
                       </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 px-2 py-1">
                       <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                         <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                           Undergoing Priority Integrity Review
                         </p>
                       </div>
                       <div className="hidden sm:block h-1 w-1 bg-slate-800 rounded-full"></div>
                       <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">
                         Last Updated: {c.lastUpdated ? new Date(c.lastUpdated).toLocaleString() : 'N/A'}
                       </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
