import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiError, ApiError, authenticatedIdentity} from '@/server/api';
import {getStore} from '@/server/store';
import {localRecordTime} from '@/server/time';

const recordSchema = z.object({
  odorLevel: z.number().int().min(0).max(3),
  sourceEventId: z.string().min(8).max(120).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const {lineUserIdHash} = authenticatedIdentity(request);
    const input = recordSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ApiError(400, 'E_VALIDATION', 'Invalid odor record');
    const now = new Date();
    const local = localRecordTime(now);
    const idempotencyKey = input.data.sourceEventId ?? request.headers.get('idempotency-key') ?? crypto.randomUUID();
    const result = await getStore().recordOdor({
      lineUserIdHash,
      odorLevel: input.data.odorLevel,
      sourceEventId: `api:${lineUserIdHash.slice(0, 16)}:${idempotencyKey}`,
      recordedAt: now.toISOString(),
      ...local,
    });
    if (result.errorCode === 'USER_NOT_ONBOARDED') throw new ApiError(409, 'E_ONBOARDING_REQUIRED', 'Complete onboarding first');
    return NextResponse.json(result, {status: result.duplicate ? 200 : 201});
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const {lineUserIdHash} = authenticatedIdentity(request);
    const limitValue = Number(new URL(request.url).searchParams.get('limit') ?? '20');
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 20) {
      throw new ApiError(400, 'E_VALIDATION', 'limit must be between 1 and 20');
    }
    return NextResponse.json({records: await getStore().listRecords(lineUserIdHash, limitValue)});
  } catch (error) {
    return apiError(error);
  }
}
