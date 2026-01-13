// API route: POST /api/tasks/[taskId]/restore - Restore a task from trash

import { NextRequest, NextResponse } from 'next/server';
import { restoreTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * POST /api/tasks/[taskId]/restore
 * Restore a task from trash
 * - Only Managers can restore tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
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

    const task = await restoreTask(taskId, user);

    return NextResponse.json({ data: task, message: 'Task restored successfully' }, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
