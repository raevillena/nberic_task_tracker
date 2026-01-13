// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/read - Mark task as read

import { NextRequest, NextResponse } from 'next/server';
import { markTaskAsRead } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/read
 * Mark a task as read for the authenticated user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string; taskId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const taskId = parseInt(params.taskId, 10);

    if (isNaN(taskId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid task ID' },
        { status: 400 }
      );
    }

    await markTaskAsRead(taskId, user.id);

    return NextResponse.json({ success: true, message: 'Task marked as read' });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
