import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiError, ApiError, authenticatedIdentity} from '@/server/api';
import {getStore} from '@/server/store';

const schema = z.object({
  specialEventType: z.enum(['JUST_SCOOPED', 'JUST_CHANGED_LITTER', 'JUST_CLEANED_BOX', 'HUMID_WEATHER', 'AWAY_LONG_TIME', 'GUESTS', 'OTHER']).nullable(),
  specialEventNote: z.string().trim().max(40).nullable().default(null),
}).strict();

export async function PATCH(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    const {lineUserIdHash} = authenticatedIdentity(request);
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ApiError(400, 'E_VALIDATION', 'Invalid special event');
    const {id} = await context.params;
    const record = await getStore().updateSpecialEvent({lineUserIdHash, recordId: id, ...input.data});
    if (!record) throw new ApiError(404, 'E_RECORD_NOT_FOUND', 'Record not found');
    return NextResponse.json(record);
  } catch (error) {
    return apiError(error);
  }
}
