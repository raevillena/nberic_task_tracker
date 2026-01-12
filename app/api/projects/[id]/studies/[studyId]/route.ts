// API route: GET /api/projects/[id]/studies/[studyId], PUT /api/projects/[id]/studies/[studyId], DELETE /api/projects/[id]/studies/[studyId]

import { NextRequest, NextResponse } from 'next/server';
import { getStudyById, updateStudy, deleteStudy } from '@/services/studyService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../middleware';
import { UpdateStudyRequest } from '@/types/api';

/**
 * GET /api/projects/[id]/studies/[studyId]
 * Get a single study by ID
 */
export async function GET(
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

    const study = await getStudyById(studyId, user);

    return NextResponse.json({ data: study });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * PUT /api/projects/[id]/studies/[studyId]
 * Update a study
 * - Only Managers can update studies
 */
export async function PUT(
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

    const body: UpdateStudyRequest = await request.json();
    const study = await updateStudy(studyId, body, user);

    return NextResponse.json({ data: study });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * DELETE /api/projects/[id]/studies/[studyId]
 * Delete a study
 * - Only Managers can delete studies
 * - Cascades to delete all tasks
 */
export async function DELETE(
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

    await deleteStudy(studyId, user);

    return NextResponse.json({ message: 'Study deleted successfully' }, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

