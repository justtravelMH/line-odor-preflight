import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {
  baselineProgressFlex,
  odorQuickReplies,
  parsePostback,
  replyLine,
  validLineSignature,
  type LineReplyMessage,
} from '@/lib/line';
import {hashLineUserId} from '@/server/identity';
import {getStore} from '@/server/store';
import {localRecordTime} from '@/server/time';

type Event = {
  webhookEventId?: string;
  type?: string;
  timestamp?: number;
  replyToken?: string;
  postback?: {data?: string};
  source?: {userId?: string};
};

const onboardingReply: LineReplyMessage = {
  type: 'text',
  text: '請先從選單開啟設定頁，完成首次設定後再開始記錄。',
};

export async function POST(request: Request) {
  const raw = await request.text();
  const requestId = crypto.randomUUID();
  if (!validLineSignature(raw, request.headers.get('x-line-signature'), process.env.LINE_CHANNEL_SECRET ?? '')) {
    return NextResponse.json(
      {error: {code: 'E_SIGNATURE_INVALID', message: 'Invalid signature', requestId}},
      {status: 401},
    );
  }

  let body: {events?: Event[]};
  try {
    body = JSON.parse(raw) as {events?: Event[]};
  } catch {
    return NextResponse.json(
      {error: {code: 'E_EVENT_MALFORMED', message: 'Malformed event', requestId}},
      {status: 400},
    );
  }

  const payloadSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const store = getStore();
  for (const event of body.events ?? []) {
    const eventId = event.webhookEventId;
    if (!eventId) continue;
    try {
      const command = event.postback?.data ? parsePostback(event.postback.data) : null;
      if (command?.action === 'record_start') {
        const registered = await store.registerWebhook({webhookEventId: eventId, eventType: event.type ?? 'postback', payloadSha256});
        if (!registered.duplicate && event.replyToken) await replyLine(event.replyToken, [odorQuickReplies]);
        continue;
      }

      if (command?.action === 'record_odor' && command.level) {
        if (!event.source?.userId) continue;
        const recordedAt = new Date(
          typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? event.timestamp : Date.now(),
        );
        const result = await store.recordOdor({
          lineUserIdHash: hashLineUserId(event.source.userId),
          odorLevel: Number(command.level),
          sourceEventId: eventId,
          recordedAt: recordedAt.toISOString(),
          ...localRecordTime(recordedAt),
          webhookEventId: eventId,
          eventType: event.type ?? 'postback',
          payloadSha256,
        });
        if (result.duplicate || !event.replyToken) continue;
        await replyLine(
          event.replyToken,
          result.errorCode === 'USER_NOT_ONBOARDED' ? [onboardingReply] : [baselineProgressFlex(result)],
        );
        continue;
      }

      await store.registerWebhook({webhookEventId: eventId, eventType: event.type ?? 'unknown', payloadSha256});
    } catch (error) {
      console.error('WEBHOOK_PROCESSING_FAILED', {
        requestId,
        eventId,
        errorCode: error instanceof Error ? error.message.split(':', 1)[0] : 'unknown',
      });
    }
  }
  return NextResponse.json({ok: true, requestId});
}
