import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiError, ApiError} from '@/server/api';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyLineIdToken,
} from '@/server/auth/line-session';

const schema = z.object({idToken: z.string().min(1).max(8192)}).strict();

export async function POST(request: Request) {
  try {
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ApiError(400, 'E_VALIDATION', 'Invalid session request');
    const verified = await verifyLineIdToken(input.data.idToken);
    const session = createSessionToken(verified.lineUserId);
    const response = NextResponse.json({authenticated: true, expiresAt: session.expiresAt});
    response.cookies.set(SESSION_COOKIE_NAME, session.value, sessionCookieOptions);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
