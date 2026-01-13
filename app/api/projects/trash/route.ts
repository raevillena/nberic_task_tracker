// API route: GET /api/projects/trash - Get all projects in trash

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/services/projectService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/projects/trash
 * Get all deleted projects (in trash)
 * - Only Managers can view trash
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const projects = await projectService.getTrashProjects(user);

    return NextResponse.json({ data: projects });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
