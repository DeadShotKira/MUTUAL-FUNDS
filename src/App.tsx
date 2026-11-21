import React, { useState, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RefreshCw } from 'lucide-react';

// Lazy-load DashboardPage to prevent downloading Three.js and Recharts before login
const DashboardPage = React.lazy(() =>
  import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage }))
);

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-fintech-dark flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shadow-glow-cyan">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-widest text-slate-400">
          Verifying Session...
        </p>
      </div>
    );
  }

  // Allow preview ONLY in development mode (import.meta.env.DEV). In production, strictly require user.
  const isAuthorized = user || (import.meta.env.DEV && previewMode);

  if (isAuthorized) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-fintech-dark flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shadow-glow-cyan">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
          <p className="mt-4 text-xs font-mono uppercase tracking-widest text-slate-400">
            Initializing Portfolio Dashboard...
          </p>
        </div>
      }>
        <DashboardPage />
      </Suspense>
    );
  }

  return (
    <LoginPage
      onEnterPreview={import.meta.env.DEV ? () => setPreviewMode(true) : undefined}
    />
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
