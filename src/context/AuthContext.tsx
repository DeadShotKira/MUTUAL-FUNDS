import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../types/auth';
import { fetchCurrentUser, loginWithGoogleToken, logoutUser } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch (err: any) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const loginWithGoogle = async (credential: string): Promise<boolean> => {
    try {
      setError(null);
      setLoading(true);
      const res = await loginWithGoogleToken(credential);
      if (res.success && res.user) {
        setUser(res.user);
        return true;
      } else {
        setError(res.error || 'Authentication failed');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Login error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    await logoutUser();
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithGoogle, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
