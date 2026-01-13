// API route: GET /api/projects/[id], PUT /api/projects/[id], DELETE /api/projects/[id]

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/services/projectService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';
import { UpdateProjectRequest } from '@/types/api';

/**
 * GET /api/projects/[id]
 * Get a single project by ID
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

    const project = await projectService.getProjectById(projectId, user);

    return NextResponse.json({ data: project });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * PUT /api/projects/[id]
 * Update a project
 * - Only Managers can update projects
 */
export async function PUT(
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

    const body: UpdateProjectRequest = await request.json();
    const project = await projectService.updateProject(projectId, body, user);

    return NextResponse.json({ data: project });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project (soft delete - moves to trash)
 * - Only Managers can delete projects
 * - Projects are not permanently deleted, just moved to trash
 */
export async function DELETE(
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

    await projectService.deleteProject(projectId, user);

    return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
