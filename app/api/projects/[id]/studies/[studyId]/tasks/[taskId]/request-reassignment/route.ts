// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/request-reassignment

import { NextRequest, NextResponse } from 'next/server';
import { requestTaskReassignment } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';
import { emitTaskRequestCreated } from '@/lib/socket/taskRequestEvents';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/request-reassignment
 * Request task reassignment (Researcher only)
 * - Creates a pending reassignment request for manager approval
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studyId: string; taskId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { taskId: taskIdParam } = await params;
    const taskId = parseInt(taskIdParam, 10);

    if (isNaN(taskId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid task ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { requestedAssignedToId, notes } = body;

    if (!requestedAssignedToId || isNaN(requestedAssignedToId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'requestedAssignedToId is required and must be a valid number' },
        { status: 400 }
      );
    }

    const taskRequest = await requestTaskReassignment(
      taskId,
      requestedAssignedToId,
      user,
      notes
    );

    // Emit socket event to notify managers
    // Don't await to avoid blocking the response
    emitTaskRequestCreated(taskRequest).catch((err) => {
      console.error('Failed to emit task-request:created event:', err);
    });

    return NextResponse.json({ data: taskRequest });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
