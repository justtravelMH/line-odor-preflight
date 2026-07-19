import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiError, ApiError} from '@/server/api';
import {sessionFromRequest} from '@/server/auth/line-session';
import {encryptLineUserId, hashLineUserId} from '@/server/identity';
import {getStore} from '@/server/store';

const schema = z.object({
  litterBoxCount: z.number().int().min(1).max(4),
  observationContext: z.enum(['NEAR_BOX', 'ENTER_ROOM', 'FIXED_SPOT']),
  privacyVersion: z.literal('2026-07-19'),
  locale: z.string().min(2).max(16).default('zh-TW'),
  timezone: z.string().min(3).max(64).default('Asia/Taipei'),
}).strict();

export async function POST(request: Request) {
  try {
    const session = sessionFromRequest(request);
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ApiError(400, 'E_VALIDATION', 'Invalid onboarding input');
    const state = await getStore().completeOnboarding({
      lineUserIdHash: hashLineUserId(session.lineUserId),
      lineUserIdEncrypted: encryptLineUserId(session.lineUserId),
      ...input.data,
    });
    return NextResponse.json(state, {status: 201});
  } catch (error) {
    return apiError(error);
  }
}
