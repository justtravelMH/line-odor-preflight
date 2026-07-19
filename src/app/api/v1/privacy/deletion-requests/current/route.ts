import {NextResponse} from 'next/server';
import {apiError, authenticatedIdentity} from '@/server/api';
import {getStore} from '@/server/store';

export async function GET(request: Request) {
  try {
    const {lineUserIdHash} = authenticatedIdentity(request);
    return NextResponse.json({request: await getStore().getCurrentDeletionRequest(lineUserIdHash)});
  } catch (error) {
    return apiError(error);
  }
}
