import { DashboardData } from '../types/portfolio';
import { User } from '../types/auth';

export async function fetchPortfolioDashboard(forceRefresh: boolean = false): Promise<DashboardData> {
  const url = `/api/dashboard${forceRefresh ? '?refresh=true' : ''}`;
  
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

  // Parse server error response honestly
  let errorMsg = `Server returned status HTTP ${res.status}`;
  try {
    const errJson = await res.json();
    if (errJson && errJson.error) {
      errorMsg = errJson.error;
      if (errJson.details) {
        errorMsg += `: ${typeof errJson.details === 'string' ? errJson.details : JSON.stringify(errJson.details)}`;
      }
    }
  } catch (_) {
    // Ignore json parse error
  }

  throw new Error(errorMsg);
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Authentication failed (HTTP ${res.status})`
      };
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error communicating with authentication service' };
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
