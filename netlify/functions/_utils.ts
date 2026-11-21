import crypto from 'crypto';

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  iat: number;
  exp: number;
}

const DEFAULT_SECRET = 'mutual-fund-3d-portfolio-secure-session-key-2026';

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEFAULT_SECRET;
}

/**
 * Creates a signed stateless token using HMAC-SHA256
 */
export function signSession(user: { email: string; name: string; picture?: string }): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: UserSession = {
    email: user.email.toLowerCase().trim(),
    name: user.name,
    picture: user.picture,
    iat: now,
    exp: now + 7 * 24 * 60 * 60 // 7 days
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token
 */
export function verifySession(token: string): UserSession | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadB64, signature] = token.split('.');
    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const session: UserSession = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (session.exp && session.exp < now) {
      return null; // Expired
    }

    return session;
  } catch (err) {
    return null;
  }
}

/**
 * Parse cookies from header string
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('='));
    }
  });

  return list;
}

/**
 * Creates Set-Cookie header for session token
 */
export function createSessionCookie(token: string, isProduction: boolean = true): string {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  const secure = isProduction ? 'Secure; ' : '';
  return `session_token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; ${secure}SameSite=Lax`;
}

/**
 * Creates Clear-Cookie header
 */
export function clearSessionCookie(isProduction: boolean = true): string {
  const secure = isProduction ? 'Secure; ' : '';
  return `session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${secure}SameSite=Lax`;
}

/**
 * Standard JSON Response builder
 */
export function jsonResponse(body: any, status: number = 200, headers: Record<string, string> = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...headers
    },
    body: JSON.stringify(body)
  };
}
