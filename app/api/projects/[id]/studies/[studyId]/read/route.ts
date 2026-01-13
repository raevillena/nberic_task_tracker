// API route: POST /api/projects/[id]/studies/[studyId]/read - Mark study as read

import { NextRequest, NextResponse } from 'next/server';
import { markStudyAsRead } from '@/services/studyService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../middleware';

/**
 * POST /api/projects/[id]/studies/[studyId]/read
 * Mark a study as read for the authenticated user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const studyId = parseInt(params.studyId, 10);

    if (isNaN(studyId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    await markStudyAsRead(studyId, user.id);

    return NextResponse.json({ success: true, message: 'Study marked as read' });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
