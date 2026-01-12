// API route: GET /api/tasks - Get all tasks

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks } from '@/services/taskService';
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

    return NextResponse.json({ data: tasks });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
