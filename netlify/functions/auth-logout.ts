import { Handler } from '@netlify/functions';
import { clearSessionCookie, jsonResponse } from './_utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const isProd = process.env.NODE_ENV === 'production' || !!process.env.NETLIFY;
  const cookieHeader = clearSessionCookie(isProd);

  return jsonResponse(
    { success: true, message: 'Logged out successfully' },
    200,
    { 'Set-Cookie': cookieHeader }
  );
};
