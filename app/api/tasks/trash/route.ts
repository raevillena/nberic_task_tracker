// API route: GET /api/tasks/trash - Get all tasks in trash

import { NextRequest, NextResponse } from 'next/server';
import { getTrashTasks } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/tasks/trash
 * Get all deleted tasks (in trash)
 * - Only Managers can view trash
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const tasks = await getTrashTasks(user);

    return NextResponse.json({ data: tasks });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
