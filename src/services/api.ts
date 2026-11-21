import { DashboardData } from '../types/portfolio';
import { User } from '../types/auth';
import { MOCK_DASHBOARD_DATA } from './mockData';

export async function fetchPortfolioDashboard(forceRefresh: boolean = false): Promise<DashboardData> {
  const url = `/api/dashboard${forceRefresh ? '?refresh=true' : ''}`;
  try {
    const res = await fetch(url);
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        return {
          ...json.data,
          _fromCache: json._fromCache,
          _cachedAt: json._cachedAt
        };
      }
    }

    // If server returned 503 (backend not yet configured) or during local dev Vite proxy missing
    if (res.status === 503 || res.status === 404 || res.status === 502) {
      console.warn('Backend API returned status', res.status, '- Falling back to demo preview mode');
      return {
        ...MOCK_DASHBOARD_DATA,
        _isDemo: true
      };
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch portfolio data (HTTP ${res.status})`);
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      throw err;
    }
    console.warn('API error encountered, activating demo mode for preview:', err.message);
    return {
      ...MOCK_DASHBOARD_DATA,
      _isDemo: true
    };
  }
}

export async function loginWithGoogleToken(credential: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const res = await fetch('/api/auth-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credential })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Authentication failed' };
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    // In local dev without Netlify Functions CLI, simulate login for developer preview
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.warn('Local environment detected without Netlify functions; falling back to demo session');
      return {
        success: true,
        user: {
          email: 'investor@portfolio.preview',
          name: 'Demo Portfolio Manager',
          picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
        }
      };
    }
    return { success: false, error: err.message || 'Network error during login' };
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth-me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch (err) {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth-logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }
}
