// API route: GET /api/studies/trash - Get all studies in trash

import { NextRequest, NextResponse } from 'next/server';
import { getTrashStudies } from '@/services/studyService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/studies/trash
 * Get all deleted studies (in trash)
 * - Only Managers can view trash
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const studies = await getTrashStudies(user);

    return NextResponse.json({ data: studies });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
