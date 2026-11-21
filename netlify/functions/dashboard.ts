import { Handler } from '@netlify/functions';
import { parseCookies, verifySession, jsonResponse } from './_utils';

// In-memory cache to conserve Netlify Free tier serverless execution minutes & speed up responses
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 90 * 1000; // 90 seconds cache

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // 1. Authenticate user session
  const cookies = parseCookies(event.headers.cookie);
  const token = cookies.session_token || event.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = token ? verifySession(token) : null;

  if (!session) {
    return jsonResponse({ error: 'Unauthorized: Please log in to view portfolio data' }, 401);
  }

  const now = Date.now();
  const query = event.queryStringParameters || {};
  const forceRefresh = query.refresh === 'true';

  // 2. Return cached response if valid and not force-refreshed
  if (!forceRefresh && cachedData && (now - lastFetchTime) < CACHE_TTL_MS) {
    return jsonResponse({
      ...cachedData,
      _fromCache: true,
      _cachedAt: new Date(lastFetchTime).toISOString()
    });
  }

  // 3. Check Apps Script URL & secret configuration
  const gasUrl = process.env.DASHBOARD_API_URL;
  const gasSecret = process.env.DASHBOARD_API_SHARED_SECRET;

  if (!gasUrl || !gasSecret) {
    return jsonResponse({
      error: 'Backend is not configured. DASHBOARD_API_URL or DASHBOARD_API_SHARED_SECRET missing in environment.',
      configHelp: 'Configure these environment variables in your Netlify dashboard.'
    }, 503);
  }

  // 4. Fetch from Google Apps Script Web App
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret: gasSecret,
        action: 'getPortfolioDashboard'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return jsonResponse({
        error: `Google Apps Script returned HTTP ${res.status}`,
        details: errText
      }, 502);
    }

    const payload = await res.json();
    if (!payload.success) {
      return jsonResponse({
        error: payload.error || 'Google Apps Script API returned an error',
        details: payload
      }, 502);
    }

    // Save to cache
    cachedData = payload;
    lastFetchTime = now;

    return jsonResponse({
      ...payload,
      _fromCache: false,
      _fetchedAt: new Date(now).toISOString()
    });

  } catch (error: any) {
    return jsonResponse({
      error: 'Failed to communicate with Google Apps Script API',
      message: error.message || String(error)
    }, 502);
  }
};
