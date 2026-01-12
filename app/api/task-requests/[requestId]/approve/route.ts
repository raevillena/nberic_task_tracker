// API route: POST /api/task-requests/[requestId]/approve

import { NextRequest, NextResponse } from 'next/server';
import { approveTaskRequest } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../middleware';
import { sequelize } from '@/lib/db/connection';
import { emitTaskRequestApproved } from '@/lib/socket/taskRequestEvents';
import { getSocketInstance } from '@/lib/socket/instance';
import { TaskRequestType } from '@/types/entities';

/**
 * POST /api/task-requests/[requestId]/approve
 * Approve a task request (Manager only)
 * - Approves and processes completion or reassignment requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const transaction = await sequelize.transaction();

  try {
    const user = await getAuthenticatedUser(request);
    const requestId = parseInt(params.requestId, 10);

    if (isNaN(requestId)) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid request ID' },
        { status: 400 }
      );
    }

    const result = await approveTaskRequest(requestId, user, transaction);
    await transaction.commit();

    // Emit socket event to notify the researcher who made the request
    // Don't await to avoid blocking the response
    emitTaskRequestApproved({
      ...result.request,
      task: result.task,
      reviewedBy: user,
    } as any).catch((err) => {
      console.error('Failed to emit task-request:approved event:', err);
    });

    // If this was a completion request, also emit task:completed event to update all clients
    if (result.request.requestType === TaskRequestType.COMPLETION) {
      const io = getSocketInstance();
      if (io) {
        io.emit('task:completed', { task: result.task });
      } else {
        // Fallback to HTTP if socket not available
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        fetch(`${socketUrl}/api/socket/emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'task:completed',
            payload: { task: result.task },
          }),
        }).catch((err) => {
          console.error('Failed to emit task:completed via HTTP:', err);
        });
      }
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    await transaction.rollback();
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
