import React, { useState } from "react";
import { apiClient } from "../services/api";
import { User } from "../types";

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        const { user } = await apiClient.register(
          name,
          email,
          password,
          confirmPassword,
        );
        onLogin(user);
      } else {
        const { user } = await apiClient.login(email, password);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#04060b] relative overflow-hidden font-sans">
      {/* Background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-nexus-emerald/5 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-nexus-accent/5 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-nexus-emerald to-emerald-800 rounded-3xl flex items-center justify-center font-black text-nexus-950 text-4xl shadow-2xl shadow-nexus-emerald/20 animate-fade-in">
            Z
          </div>
        </div>

        <div
          className="glass-card p-10 rounded-[3rem] border border-white/5 shadow-2xl animate-fade-in"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">
              {isRegistering ? "New Account" : "Login"}
            </h1>
            <p className="text-slate-500 text-[10px] font-black tracking-[0.2em] uppercase">
              {isRegistering ? "Create your account" : "Access your account"}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-[#080c18] border border-white/5 text-white focus:outline-none focus:border-nexus-emerald/50 transition-all font-medium"
                  placeholder="Full Name"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-[#080c18] border border-white/5 text-white focus:outline-none focus:border-nexus-emerald/50 transition-all font-medium"
                placeholder="Email"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-6 py-4 pr-14 rounded-2xl bg-[#080c18] border border-white/5 text-white focus:outline-none focus:border-nexus-emerald/50 transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-nexus-emerald transition-colors p-1"
                  tabIndex={-1}>
                  {showPassword
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-6 py-4 pr-14 rounded-2xl bg-[#080c18] border border-white/5 text-white focus:outline-none focus:border-nexus-emerald/50 transition-all font-medium"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-nexus-emerald transition-colors p-1"
                    tabIndex={-1}>
                    {showConfirmPassword
                      ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-nexus-emerald to-emerald-600 text-nexus-950 font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-nexus-emerald/20 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Processing..." : isRegistering ? "Register" : "Login"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[10px] font-black text-slate-600 hover:text-nexus-emerald uppercase tracking-widest transition-colors"
            >
              {isRegistering
                ? "Already have a username? Sign in"
                : "Not registered? Register new as a user"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
