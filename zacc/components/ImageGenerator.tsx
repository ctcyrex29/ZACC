
import React, { useState, useEffect } from 'react';
import { generateAwarenessImage } from '../services/gemini';

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<"1K" | "2K" | "4K">("1K");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
    setHasApiKey(!!hasKey);
  };

  const handleOpenKeyDialog = async () => {
    await (window as any).aistudio?.openSelectKey();
    setHasApiKey(true);
  };

  const handleGenerate = async () => {
    if (!prompt || loading) return;
    setLoading(true);
    try {
      const imgUrl = await generateAwarenessImage(prompt, size);
      setImage(imgUrl);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="glass-card p-16 rounded-5xl text-center max-w-2xl mx-auto shadow-2xl animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl grayscale">🔑</div>
        <div className="w-24 h-24 bg-nexus-emerald/10 text-nexus-emerald rounded-[2rem] border border-nexus-emerald/20 flex items-center justify-center mx-auto mb-10 text-4xl soft-glow">🔑</div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">High-Level Clearance Required</h2>
        <p className="text-slate-500 font-medium leading-relaxed max-w-md mx-auto mb-12 uppercase text-[10px] tracking-[0.2em]">
          Deep-field visual generation (2K/4K) requires a decrypted API key. 
          Please initialize a key from a secure Google AI project.
        </p>
        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={handleOpenKeyDialog}
            className="bg-nexus-emerald text-nexus-950 px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all soft-glow shadow-xl shadow-nexus-emerald/20"
          >
            Authenticate API Key
          </button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[10px] text-slate-600 hover:text-nexus-emerald font-black uppercase tracking-widest transition-colors">
            Procurement Protocols
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-7xl mx-auto animate-fade-in">
      <div className="lg:col-span-5 space-y-8">
        <div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-32 h-32 bg-nexus-emerald/5 blur-3xl rounded-full"></div>
          <h2 className="text-xl font-black text-white mb-8 uppercase tracking-tighter">Campaign Engine</h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Visual Objective</label>
              <textarea 
                className="w-full bg-[#080c18] p-6 rounded-2xl border border-white/10 text-white font-medium focus:outline-none focus:border-nexus-emerald/50 transition-all placeholder:text-slate-800"
                placeholder="Describe campaign theme... e.g., 'Modern digital poster showing hands holding a transparent shield over Zimbabwe map.'"
                rows={5}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Vector Density</label>
              <div className="grid grid-cols-3 gap-4">
                {(['1K', '2K', '4K'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`py-4 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                      size === s ? 'bg-nexus-emerald text-nexus-950 border-nexus-emerald soft-glow' : 'bg-white/5 text-slate-500 border-transparent hover:border-white/10'
                    }`}
                  >
                    {s} RESOLUTION
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-4 ${
                loading ? 'bg-white/5 text-slate-600' : 'bg-nexus-emerald text-nexus-950 hover:bg-emerald-400 soft-glow shadow-xl shadow-nexus-emerald/20'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div>
                  <span>Rendering...</span>
                </>
              ) : (
                <span>Initialize Visual Render</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="bg-[#080c18] rounded-[3rem] border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden min-h-[500px] shadow-inner relative group">
          {image ? (
            <div className="relative w-full h-full animate-fade-in">
              <img src={image} alt="Generated Poster" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                <p className="text-[10px] font-black text-nexus-emerald uppercase tracking-[0.3em] mb-4">Render Successful</p>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 max-w-sm">Campaign material ready for distribution</h3>
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = image;
                    link.download = 'nexus-awareness-poster.png';
                    link.click();
                  }}
                  className="bg-white text-nexus-950 px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
                >
                  Download Master Original
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center p-10">
              <div className="text-7xl mb-8 filter grayscale opacity-20 group-hover:opacity-40 transition-opacity">🖼️</div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Visualizer Offline</p>
              <p className="text-xs text-slate-700 font-bold uppercase tracking-tight">Awaiting intelligence input for render</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
