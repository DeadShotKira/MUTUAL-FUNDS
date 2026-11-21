import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MOCK_DASHBOARD_DATA } from './services/mockData';
import { RefreshCw } from 'lucide-react';

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

  // If user is logged in or preview demo requested
  if (user || previewMode) {
    return <DashboardPage initialData={previewMode && !user ? MOCK_DASHBOARD_DATA : null} />;
  }

  return <LoginPage onEnterPreview={() => setPreviewMode(true)} />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
