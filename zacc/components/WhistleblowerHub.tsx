
import React from 'react';

export const WhistleblowerHub: React.FC = () => {
  const laws = [
    { title: 'Anti-Corruption Act', description: 'Governs the powers and functions of ZACC.', tag: 'Core Law' },
    { title: 'Whistleblower Protection Bill', description: 'Legal framework for protecting those who speak up.', tag: 'Protection' },
    { title: 'Money Laundering Act', description: 'Provisions for reporting financial irregularities.', tag: 'Financial' },
  ];

  const resources = [
    { name: 'Legal Aid Society', contact: '0808 123 4567', icon: '⚖️' },
    { name: 'Human Rights Commission', contact: '0242 703 123', icon: '🌍' },
    { name: 'Transparency International', contact: 'info@tiz.org', icon: '🔍' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="glass-card p-10 rounded-[3rem] border border-white/5">
            <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-nexus-emerald/10 text-nexus-emerald flex items-center justify-center text-sm">🛡️</span>
              Identity Protection Rights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Protection from Retaliation',
                'Identity Confidentiality',
                'Legal Immunity for Reporting',
                'Right to Professional Counsel',
                'Reward for Successful Recovery',
                'Security Shielding from ZACC'
              ].map((right, i) => (
                <div key={i} className="flex items-center space-x-3 p-5 bg-white/5 rounded-2xl border border-transparent hover:border-nexus-emerald/20 transition-all group">
                  <div className="w-6 h-6 bg-nexus-emerald/10 text-nexus-emerald rounded-full flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform">✓</div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider group-hover:text-white transition-colors">{right}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-10 rounded-[3rem] border border-white/5">
            <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-nexus-accent/10 text-nexus-accent flex items-center justify-center text-sm">📚</span>
              Legal Framework dossiers
            </h3>
            <div className="space-y-4">
              {laws.map((law, i) => (
                <div key={i} className="flex items-center justify-between p-6 bg-white/5 border border-transparent rounded-[2rem] hover:border-white/10 transition-all cursor-pointer group">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h4 className="font-black text-white text-sm uppercase tracking-tight">{law.title}</h4>
                      <span className="text-[9px] bg-nexus-emerald/10 text-nexus-emerald px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{law.tag}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 font-medium">{law.description}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 group-hover:text-nexus-emerald group-hover:bg-nexus-emerald/10 transition-all">
                    →
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-900 to-black p-10 rounded-[3rem] border border-nexus-emerald/20 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-emerald/5 blur-3xl rounded-full"></div>
            <h3 className="text-xl font-black text-white mb-4 relative z-10">Extraction Support</h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8 relative z-10">If you are in immediate danger due to a submission, trigger the encrypted emergency uplink.</p>
            <div className="bg-black/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 mb-8 relative z-10">
              <p className="text-[10px] font-black text-nexus-emerald uppercase tracking-[0.3em] mb-2">Secure Link 01</p>
              <p className="text-2xl font-black text-white tracking-widest">999-ZACC-PRO</p>
            </div>
            <button className="w-full bg-nexus-emerald hover:bg-emerald-400 text-nexus-950 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all soft-glow">
              Request Extraction
            </button>
          </div>

          <div className="glass-card p-10 rounded-[3rem] border border-white/5">
            <h3 className="text-lg font-black text-white mb-6 uppercase tracking-tight">Support Network</h3>
            <div className="space-y-8">
              {resources.map((res, i) => (
                <div key={i} className="flex items-start space-x-5 group">
                  <div className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">{res.icon}</div>
                  <div>
                    <h4 className="font-black text-white text-xs uppercase tracking-widest mb-1">{res.name}</h4>
                    <p className="text-[10px] text-nexus-emerald font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{res.contact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
