
import React, { useState, useRef, useEffect } from 'react';
import { getChatbotResponse } from '../services/gemini';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export const AIChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Identity verified. I am your ZACC Integrity Intelligence Node. How can I assist your mission today? I can analyze procedures, decode whistleblower rights, or decrypt anti-corruption legislation.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await getChatbotResponse(userMsg, messages);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Signal interference detected. Encryption handshake failed. Please re-initialize request." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-[3rem] border border-white/5 flex flex-col h-[700px] max-w-5xl mx-auto overflow-hidden animate-fade-in shadow-2xl">
      <div className="p-8 border-b border-white/5 bg-[#080c18]/50 backdrop-blur-3xl flex items-center justify-between">
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 bg-gradient-to-br from-nexus-emerald/20 to-emerald-900/10 rounded-2xl flex items-center justify-center text-2xl border border-nexus-emerald/20 soft-glow">🤖</div>
          <div>
            <h3 className="font-black text-white uppercase tracking-tighter">Integrity Intelligence</h3>
            <p className="text-[10px] text-nexus-emerald font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-nexus-emerald animate-pulse"></span>
              Encrypted Uplink Active
            </p>
          </div>
        </div>
        <div className="hidden md:block text-right">
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Latency: 24ms</p>
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Node: ZACC-INTEL-01</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 bg-black/20 scroll-smooth">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[85%] p-6 rounded-3xl ${
              msg.role === 'user' 
                ? 'bg-nexus-emerald text-nexus-950 font-bold rounded-tr-none shadow-xl shadow-nexus-emerald/10' 
                : 'bg-[#0f172a] text-slate-200 border border-white/5 rounded-tl-none shadow-xl'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/5 rounded-tl-none flex items-center space-x-3">
              <div className="w-2 h-2 bg-nexus-emerald rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-nexus-emerald rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-nexus-emerald rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Deciphering...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-white/5 bg-[#080c18]/80 backdrop-blur-xl">
        <div className="flex space-x-4">
          <input 
            type="text"
            placeholder="Input intelligence query or procedural request..."
            className="flex-1 bg-black/40 p-5 rounded-2xl border border-white/10 text-white font-medium focus:outline-none focus:border-nexus-emerald/50 transition-all placeholder:text-slate-700"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="bg-white/5 text-nexus-emerald px-10 rounded-2xl font-black uppercase tracking-widest border border-nexus-emerald/20 hover:bg-nexus-emerald hover:text-nexus-950 transition-all disabled:opacity-50 soft-glow group active:scale-95"
          >
            Transmit
            <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
          </button>
        </div>
        <div className="flex items-center justify-center gap-6 mt-6">
            <p className="text-[9px] text-slate-700 font-extrabold uppercase tracking-[0.3em]">AES-256 Extraction</p>
            <div className="w-1 h-1 bg-slate-800 rounded-full"></div>
            <p className="text-[9px] text-slate-700 font-extrabold uppercase tracking-[0.3em]">End-to-End Persistence: 0%</p>
            <div className="w-1 h-1 bg-slate-800 rounded-full"></div>
            <p className="text-[9px] text-slate-700 font-extrabold uppercase tracking-[0.3em]">Node Security: MAXIMUM</p>
        </div>
      </div>
    </div>
  );
};
