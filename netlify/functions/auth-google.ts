import { Handler } from '@netlify/functions';
import { signSession, createSessionCookie, jsonResponse } from './_utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { credential } = body;

    if (!credential) {
      return jsonResponse({ error: 'Missing Google credential' }, 400);
    }

    // Verify token with Google's public tokeninfo endpoint
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!googleRes.ok) {
      return jsonResponse({ error: 'Invalid Google credential token' }, 401);
    }

    const payload = await googleRes.json();
    const email = (payload.email || '').toLowerCase().trim();
    const emailVerified = payload.email_verified === 'true' || payload.email_verified === true;
    const name = payload.name || payload.given_name || email.split('@')[0];
    const picture = payload.picture;

    if (!email || !emailVerified) {
      return jsonResponse({ error: 'Google account email is not verified' }, 403);
    }

    // Verify Google Client ID matches if configured
    const configuredClientId = process.env.GOOGLE_CLIENT_ID;
    if (configuredClientId && payload.aud !== configuredClientId) {
      return jsonResponse({ error: 'OAuth client ID mismatch' }, 403);
    }

    // Check allowed emails list
    const allowedEmailsEnv = process.env.DASHBOARD_ALLOWED_EMAILS;
    if (allowedEmailsEnv) {
      const allowedList = allowedEmailsEnv
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

      if (allowedList.length > 0 && !allowedList.includes(email)) {
        return jsonResponse({
          error: `Access denied. Email '${email}' is not in the authorized portfolio viewers list.`
        }, 403);
      }
    }

    // Generate signed session cookie
    const token = signSession({ email, name, picture });
    const isProd = process.env.NODE_ENV === 'production' || !!process.env.NETLIFY;
    const cookieHeader = createSessionCookie(token, isProd);

    return jsonResponse(
      {
        success: true,
        user: { email, name, picture }
      },
      200,
      {
        'Set-Cookie': cookieHeader
      }
    );

  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Authentication failed' }, 500);
  }
};
