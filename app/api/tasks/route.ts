// API route: GET /api/tasks - Get all tasks

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, getTasksReadStatus } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../middleware';

/**
 * GET /api/tasks
 * Get all tasks
 * - Managers: See all tasks
 * - Researchers: See only assigned tasks
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const tasks = await getAllTasks(user);

    // Get read status for all tasks
    const taskIds = tasks.map((t) => t.id);
    const readStatus = await getTasksReadStatus(taskIds, user.id);

    // Add isRead property to each task
    const tasksWithReadStatus = tasks.map((task) => ({
      ...task.toJSON(),
      isRead: readStatus[task.id] || false,
    }));

    return NextResponse.json({ data: tasksWithReadStatus });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
