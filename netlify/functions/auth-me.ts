import { Handler } from '@netlify/functions';
import { parseCookies, verifySession, jsonResponse } from './_utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const cookies = parseCookies(event.headers.cookie);
    const token = cookies.session_token || event.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return jsonResponse({ authenticated: false, user: null }, 200);
    }

    const session = verifySession(token);
    if (!session) {
      return jsonResponse({ authenticated: false, user: null }, 200);
    }

    return jsonResponse({
      authenticated: true,
      user: {
        email: session.email,
        name: session.name,
        picture: session.picture
      }
    }, 200);

  } catch (error: any) {
    return jsonResponse({ authenticated: false, error: error.message }, 500);
  }
};
