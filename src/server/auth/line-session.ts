import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'line_odor_session';
const SESSION_SECONDS = 60 * 60;
const LINE_ISSUER = 'https://access.line.me';

export class SessionError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

type LineVerifyPayload = {iss?: unknown; aud?: unknown; exp?: unknown; sub?: unknown};

export async function verifyLineIdToken(idToken: string, fetcher: typeof fetch = fetch) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) throw new SessionError('LINE_LOGIN_NOT_CONFIGURED');
  if (!idToken || idToken.length > 8192) throw new SessionError('LINE_ID_TOKEN_INVALID');
  const body = new URLSearchParams({id_token: idToken, client_id: channelId});
  const response = await fetcher(
    process.env.LINE_ID_TOKEN_VERIFY_URL ?? 'https://api.line.me/oauth2/v2.1/verify',
    {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body,
      cache: 'no-store',
    },
  );
  if (!response.ok) throw new SessionError('LINE_ID_TOKEN_REJECTED');
  const payload = (await response.json()) as LineVerifyPayload;
  if (payload.iss !== LINE_ISSUER) throw new SessionError('LINE_ID_TOKEN_ISSUER');
  if (payload.aud !== channelId) throw new SessionError('LINE_ID_TOKEN_AUDIENCE');
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new SessionError('LINE_ID_TOKEN_EXPIRED');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length < 8 || payload.sub.length > 128) {
    throw new SessionError('LINE_ID_TOKEN_SUBJECT');
  }
  return {lineUserId: payload.sub, tokenExpiresAt: payload.exp};
}

function sessionKey() {
  const secret = process.env.SESSION_SIGNING_KEY;
  if (!secret || secret.length < 32) throw new SessionError('SESSION_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(secret).digest();
}

export function createSessionToken(lineUserId: string, now = Math.floor(Date.now() / 1000)) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(), iv);
  const payload = JSON.stringify({v: 1, sub: lineUserId, iat: now, exp: now + SESSION_SECONDS});
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return {
    value: [iv, ciphertext, cipher.getAuthTag()].map((part) => part.toString('base64url')).join('.'),
    expiresAt: now + SESSION_SECONDS,
  };
}

export function readSessionToken(token: string, now = Math.floor(Date.now() / 1000)) {
  try {
    const [ivText, ciphertextText, tagText] = token.split('.');
    if (!ivText || !ciphertextText || !tagText) throw new Error('parts');
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const payload = JSON.parse(plaintext) as {v?: unknown; sub?: unknown; exp?: unknown};
    if (payload.v !== 1 || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      throw new Error('payload');
    }
    if (payload.exp <= now) throw new SessionError('SESSION_EXPIRED');
    return {lineUserId: payload.sub, expiresAt: payload.exp};
  } catch (error) {
    if (error instanceof SessionError) throw error;
    throw new SessionError('SESSION_INVALID');
  }
}

export function sessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) throw new SessionError('SESSION_REQUIRED');
  return readSessionToken(decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1)));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production' && process.env.E2E_TEST_MODE !== '1',
  path: '/',
  maxAge: SESSION_SECONDS,
};
