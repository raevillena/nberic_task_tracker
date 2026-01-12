// API route: POST /api/task-requests/[requestId]/reject

import { NextRequest, NextResponse } from 'next/server';
import { rejectTaskRequest } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';
import { emitTaskRequestRejected } from '@/lib/socket/taskRequestEvents';

/**
 * POST /api/task-requests/[requestId]/reject
 * Reject a task request (Manager only)
 * - Rejects a completion or reassignment request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const requestId = parseInt(params.requestId, 10);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid request ID' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const notes = body.notes || undefined;

    const taskRequest = await rejectTaskRequest(requestId, user, notes);

    // Emit socket event to notify the researcher who made the request
    // Don't await to avoid blocking the response
    emitTaskRequestRejected({
      ...taskRequest,
      reviewedBy: user,
    } as any).catch((err) => {
      console.error('Failed to emit task-request:rejected event:', err);
    });

    return NextResponse.json({ data: taskRequest });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
