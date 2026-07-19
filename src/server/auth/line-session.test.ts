import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createSessionToken, readSessionToken, SessionError, verifyLineIdToken} from './line-session';

describe('LINE session', () => {
  beforeEach(() => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '1234567890');
    vi.stubEnv('SESSION_SIGNING_KEY', 'session-key-that-is-at-least-thirty-two-characters');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('verifies issuer, audience and expiration through the LINE endpoint', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(init?.body)).toContain('id_token=opaque-token');
      expect(String(init?.body)).toContain('client_id=1234567890');
      return Response.json({iss: 'https://access.line.me', aud: '1234567890', exp: Math.floor(Date.now() / 1000) + 60, sub: 'U1234567890'});
    }) as unknown as typeof fetch;
    await expect(verifyLineIdToken('opaque-token', fetcher)).resolves.toMatchObject({lineUserId: 'U1234567890'});
  });

  it('rejects an expired token even if the verify endpoint accepts it', async () => {
    const fetcher = vi.fn(async () => Response.json({iss: 'https://access.line.me', aud: '1234567890', exp: 1, sub: 'U1234567890'})) as unknown as typeof fetch;
    await expect(verifyLineIdToken('opaque-token', fetcher)).rejects.toMatchObject({code: 'LINE_ID_TOKEN_EXPIRED'} satisfies Partial<SessionError>);
  });

  it('encrypts the HttpOnly session payload and enforces expiration', () => {
    const token = createSessionToken('U1234567890', 100);
    expect(token.value).not.toContain('U1234567890');
    expect(readSessionToken(token.value, 101)).toEqual({lineUserId: 'U1234567890', expiresAt: 3700});
    expect(() => readSessionToken(token.value, 3700)).toThrowError('SESSION_EXPIRED');
  });
});
