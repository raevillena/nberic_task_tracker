// API route: POST /api/projects/[id]/read - Mark project as read

import { NextRequest, NextResponse } from 'next/server';
import { markProjectAsRead } from '@/services/projectService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * POST /api/projects/[id]/read
 * Mark a project as read for the authenticated user
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

    await markProjectAsRead(projectId, user.id);

    return NextResponse.json({ success: true, message: 'Project marked as read' });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
