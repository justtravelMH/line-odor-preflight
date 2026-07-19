import {NextResponse} from 'next/server';
import {SessionError, sessionFromRequest} from './auth/line-session';
import {hashLineUserId} from './identity';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message = code) {
    super(message);
  }
}

export function authenticatedIdentity(request: Request) {
  try {
    const session = sessionFromRequest(request);
    return {lineUserIdHash: hashLineUserId(session.lineUserId), session};
  } catch (error) {
    if (error instanceof SessionError) throw new ApiError(401, error.code, 'Authentication required');
    throw error;
  }
}

export function apiError(error: unknown) {
  const requestId = crypto.randomUUID();
  if (error instanceof SessionError) {
    const configurationError = error.code.endsWith('NOT_CONFIGURED');
    return NextResponse.json(
      {error: {code: error.code, message: configurationError ? 'Authentication is not configured' : 'Authentication failed', requestId}},
      {status: configurationError ? 503 : 401},
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json(
      {error: {code: error.code, message: error.message, requestId}},
      {status: error.status},
    );
  }
  const code = error instanceof Error && error.message.startsWith('SUPABASE_')
    ? 'E_DATASTORE'
    : 'E_INTERNAL';
  return NextResponse.json(
    {error: {code, message: 'Request could not be completed', requestId}},
    {status: 500},
  );
}
