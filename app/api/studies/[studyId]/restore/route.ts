// API route: POST /api/studies/[studyId]/restore - Restore a study from trash

import { NextRequest, NextResponse } from 'next/server';
import { restoreStudy } from '@/services/studyService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * POST /api/studies/[studyId]/restore
 * Restore a study from trash
 * - Only Managers can restore studies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { studyId: studyIdParam } = await params;
    const studyId = parseInt(studyIdParam, 10);

    if (isNaN(studyId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const study = await restoreStudy(studyId, user);

    return NextResponse.json({ data: study, message: 'Study restored successfully' }, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
