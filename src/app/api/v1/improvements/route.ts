import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiError, ApiError, authenticatedIdentity} from '@/server/api';
import {getStore} from '@/server/store';

const schema = z.object({
  type: z.enum(['SCOOP_MORE', 'CHANGE_LITTER', 'ADD_LITTER_BOX', 'MOVE_LITTER_BOX', 'IMPROVE_VENTILATION', 'CLEAN_LITTER_BOX', 'OTHER']),
  note: z.string().trim().max(80).nullable().default(null),
}).strict();

export async function POST(request: Request) {
  try {
    const {lineUserIdHash} = authenticatedIdentity(request);
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ApiError(400, 'E_VALIDATION', 'Invalid improvement');
    return NextResponse.json(await getStore().startImprovement({lineUserIdHash, ...input.data}), {status: 201});
  } catch (error) {
    if (error instanceof Error && error.message.includes('BASELINE_NOT_READY')) {
      return apiError(new ApiError(409, 'E_BASELINE_NOT_READY', 'Complete the baseline first'));
    }
    return apiError(error);
  }
}
