// API route: GET /api/projects/[id]/studies, POST /api/projects/[id]/studies

import { NextRequest, NextResponse } from 'next/server';
import { getStudiesByProject, createStudy } from '@/services/studyService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';
import { CreateStudyRequest } from '@/types/api';

/**
 * GET /api/projects/[id]/studies
 * Get all studies for a project
 * - Managers: See all studies
 * - Researchers: See only studies with assigned tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const projectId = parseInt(params.id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const studies = await getStudiesByProject(projectId, user);

    return NextResponse.json({ data: studies });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * POST /api/projects/[id]/studies
 * Create a new study
 * - Only Managers can create studies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const projectId = parseInt(params.id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const body: CreateStudyRequest = await request.json();
    const study = await createStudy(projectId, body, user);

    return NextResponse.json({ data: study }, { status: 201 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
