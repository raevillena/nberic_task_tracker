// API route: POST /api/projects/[id]/restore - Restore a project from trash

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/services/projectService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * POST /api/projects/[id]/restore
 * Restore a project from trash
 * - Only Managers can restore projects
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const project = await projectService.restoreProject(projectId, user);

    return NextResponse.json({ data: project, message: 'Project restored successfully' }, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
