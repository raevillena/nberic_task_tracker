// API route: GET /api/studies/[studyId]
// Get a single study by ID (without requiring projectId)

import { NextRequest, NextResponse } from 'next/server';
import { getStudyById } from '@/services/studyService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/studies/[studyId]
 * Get a single study by ID
 * This endpoint allows fetching a study without knowing the projectId first
 * Useful for cases where we need to get the projectId from the study
 */
export async function GET(
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

    const study = await getStudyById(studyId, user);

    return NextResponse.json({ data: study });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
