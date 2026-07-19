import crypto from 'node:crypto';
import type {RecordResult} from '@/server/types';

export function validLineSignature(raw: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export type Postback = {v: '1'; action: string; level?: '0' | '1' | '2' | '3'; type?: string; recordId?: string};
export function parsePostback(data: string): Postback | null {
  const params = new URLSearchParams(data);
  if (params.get('v') !== '1' || !params.get('action')) return null;
  const level = params.get('level');
  if (level !== null && !['0', '1', '2', '3'].includes(level)) return null;
  return {
    v: '1',
    action: params.get('action')!,
    level: (level ?? undefined) as Postback['level'],
    type: params.get('type') ?? undefined,
    recordId: params.get('recordId') ?? undefined,
  };
}

type QuickReplyAction = {
  type: 'action';
  action: {type: 'postback'; label: string; data: string; displayText: string};
};
type TextMessage = {type: 'text'; text: string; quickReply?: {items: QuickReplyAction[]}};
type FlexText = {type: 'text'; text: string; size?: 'sm' | 'md' | 'xl'; weight?: 'bold'; color?: string; wrap?: boolean};
type FlexBox = {type: 'box'; layout: 'vertical'; spacing?: 'sm' | 'md'; contents: Array<FlexText | FlexBox>};
export type FlexMessage = {type: 'flex'; altText: string; contents: {type: 'bubble'; body: FlexBox}};
export type LineReplyMessage = TextMessage | FlexMessage;

export const odorQuickReplies: TextMessage = {
  type: 'text',
  text: '現在味道是幾級？',
  quickReply: {
    items: [0, 1, 2, 3].map((level) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: [`0 沒聞到`, `1 一點點`, `2 明顯`, `3 很重`][level],
        data: `v=1&action=record_odor&level=${level}`,
        displayText: `記錄 ${level} 級`,
      },
    })),
  },
};

export function baselineProgressFlex(result: Pick<RecordResult, 'state' | 'baselineProgress'>): FlexMessage {
  const current = result.baselineProgress?.current ?? 0;
  const required = result.baselineProgress?.required ?? 3;
  const ready = result.state === 'BASELINE_READY';
  return {
    type: 'flex',
    altText: ready ? '日常基準已完成' : `日常基準進度 ${current}/${required}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {type: 'text', text: ready ? '日常基準已完成' : '已記下這次味道', size: 'xl', weight: 'bold', wrap: true},
          {type: 'text', text: `${current}/${required}`, size: 'xl', weight: 'bold', color: '#54745A'},
          {type: 'text', text: ready ? '現在可以選一項想改善的做法。' : '完成三筆後，就能建立你的日常基準。', size: 'sm', color: '#66685F', wrap: true},
        ],
      },
    },
  };
}

export async function replyLine(replyToken: string, messages: LineReplyMessage[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN_NOT_CONFIGURED');
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json'},
    body: JSON.stringify({replyToken, messages}),
  });
  if (!response.ok) throw new Error(`LINE_REPLY_${response.status}`);
}
