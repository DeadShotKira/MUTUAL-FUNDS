import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Activity, Lock, ArrowRight, Sparkles, Orbit, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface Props {
  onEnterPreview?: () => void;
}

export const LoginPage: React.FC<Props> = ({ onEnterPreview }) => {
  const { loginWithGoogle, loading, error } = useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // Check if Google Identity Services script is available
    const checkGIS = () => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);

        if (!clientId) {
          console.warn('VITE_GOOGLE_CLIENT_ID is not configured in environment.');
          return;
        }

        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response && response.credential) {
                await loginWithGoogle(response.credential);
              }
            },
            auto_select: false
          });

          if (googleBtnRef.current) {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              type: 'standard',
              theme: 'filled_black',
              size: 'large',
              text: 'continue_with',
              shape: 'pill',
              logo_alignment: 'left',
              width: 280
            });
          }
        } catch (e) {
          console.warn('Google Identity Services init warning:', e);
        }
      } else {
        setTimeout(checkGIS, 300);
      }
    };

    checkGIS();
  }, [clientId, loginWithGoogle]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-fintech-dark">
      {/* Background radial gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/20 via-blue-700/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-slate-900/80 border border-slate-800 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        {/* Logo and Icon */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-glow-cyan flex items-center justify-center">
            <div className="w-full h-full bg-fintech-dark rounded-[14px] flex items-center justify-center">
              <Orbit className="w-8 h-8 text-cyan-400 animate-spin-slow" />
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
            AURA
          </h1>
          <p className="mt-1 text-xs font-mono uppercase tracking-widest text-slate-400">
            Mutual Fund Portfolio Intelligence
          </p>
        </div>

        {/* Feature bullets */}
        <div className="mt-8 space-y-2.5 text-xs text-slate-300 font-mono">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Interactive 3D Three.js Investment Universe</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Real-Time AMFI NAV & Apps Script Alerts</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Encrypted Google Session & Zero-Cost Netlify Hosting</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Missing Client ID alert */}
        {!clientId && (
          <div className="mt-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Google Client ID not configured. Set <strong>VITE_GOOGLE_CLIENT_ID</strong> in your environment variables.
            </span>
          </div>
        )}

        {/* Google Sign In Button Container */}
        <div className="mt-8 flex flex-col items-center justify-center">
          <div ref={googleBtnRef} className="min-h-[44px] flex items-center justify-center">
            {!gisLoaded && clientId && (
              <div className="text-xs font-mono text-slate-500 animate-pulse">
                Loading Google Authentication...
              </div>
            )}
          </div>

          {/* Development Preview Bypass (Exclusively rendered in local dev mode) */}
          {import.meta.env.DEV && onEnterPreview && (
            <button
              onClick={onEnterPreview}
              className="mt-4 w-full py-2.5 px-4 rounded-full bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all"
            >
              <span>[DEV ONLY] Preview Local Mock UI</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}
        </div>

        {/* Private Access Notice */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Authorized Private Portfolio Access Only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
