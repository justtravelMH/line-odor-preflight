import crypto from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {POST as createSession} from '@/app/api/v1/auth/line/session/route';
import {POST as onboard} from '@/app/api/v1/onboarding/route';
import {POST as record} from '@/app/api/v1/records/route';
import {POST as webhook} from '@/app/api/v1/webhooks/line/route';
import {SESSION_COOKIE_NAME} from '@/server/auth/line-session';
import {hashLineUserId} from '@/server/identity';
import {MemoryStore} from '@/server/memory-store';
import {setStoreForTests} from '@/server/store';

const lineUserId = 'U-integration-user-0001';
const sessionSecret = 'session-key-that-is-at-least-thirty-two-characters';
const identitySecret = 'identity-key-that-is-at-least-thirty-two-characters';
const lineSecret = 'webhook-signature-secret';
let store: MemoryStore;
let cookie = '';

beforeEach(async () => {
  store = new MemoryStore();
  setStoreForTests(store);
  vi.stubEnv('SESSION_SIGNING_KEY', sessionSecret);
  vi.stubEnv('LINE_USER_ID_ENCRYPTION_KEY', identitySecret);
  vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '1234567890');
  vi.stubEnv('LINE_CHANNEL_SECRET', lineSecret);
  vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'test-channel-token');
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/oauth2/v2.1/verify')) {
      return Response.json({iss: 'https://access.line.me', aud: '1234567890', exp: Math.floor(Date.now() / 1000) + 300, sub: lineUserId});
    }
    if (url.includes('/v2/bot/message/reply')) return new Response(null, {status: 200});
    throw new Error(`UNEXPECTED_FETCH_${url}`);
  }));
  const response = await createSession(new Request('http://test/api/v1/auth/line/session', {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({idToken: 'opaque-id-token'}),
  }));
  expect(response.status).toBe(200);
  const setCookie = response.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=lax');
  cookie = `${SESSION_COOKIE_NAME}=${setCookie.split(';', 1)[0].split('=', 2)[1]}`;
});

afterEach(() => {
  setStoreForTests(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function completeOnboarding() {
  return onboard(new Request('http://test/api/v1/onboarding', {
    method: 'POST',
    headers: {'content-type': 'application/json', cookie},
    body: JSON.stringify({litterBoxCount: 2, observationContext: 'NEAR_BOX', privacyVersion: '2026-07-19'}),
  }));
}

describe('vertical slice integration', () => {
  it('writes onboarding state instead of returning a mock', async () => {
    const response = await completeOnboarding();
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({state: 'BUILDING_BASELINE', needsOnboarding: false, baselineProgress: {current: 0, required: 3}});
    await expect(store.getState(hashLineUserId(lineUserId))).resolves.toMatchObject({state: 'BUILDING_BASELINE'});
  });

  it('returns 1/3, 2/3, 3/3 and transitions to BASELINE_READY', async () => {
    await completeOnboarding();
    for (const [index, expected] of [1, 2, 3].entries()) {
      const response = await record(new Request('http://test/api/v1/records', {
        method: 'POST', headers: {'content-type': 'application/json', cookie},
        body: JSON.stringify({odorLevel: index, sourceEventId: `record-key-${expected}`}),
      }));
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({duplicate: false, baselineProgress: {current: expected, required: 3}, state: expected === 3 ? 'BASELINE_READY' : 'BUILDING_BASELINE'});
    }
  });

  it('rejects a bad webhook signature and deduplicates webhookEventId', async () => {
    await completeOnboarding();
    const raw = JSON.stringify({events: [{webhookEventId: 'evt-duplicate-0001', type: 'postback', timestamp: Date.now(), replyToken: 'reply-token', source: {userId: lineUserId}, postback: {data: 'v=1&action=record_odor&level=2'}}]});
    const bad = await webhook(new Request('http://test/api/v1/webhooks/line', {method: 'POST', headers: {'x-line-signature': 'bad'}, body: raw}));
    expect(bad.status).toBe(401);
    const signature = crypto.createHmac('sha256', lineSecret).update(raw).digest('base64');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await webhook(new Request('http://test/api/v1/webhooks/line', {method: 'POST', headers: {'x-line-signature': signature}, body: raw}));
      expect(response.status).toBe(200);
    }
    await expect(store.listRecords(hashLineUserId(lineUserId), 20)).resolves.toHaveLength(1);
  });
});
