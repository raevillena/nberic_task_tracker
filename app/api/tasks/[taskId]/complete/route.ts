// API route: POST /api/tasks/[taskId]/complete

import { NextRequest, NextResponse } from 'next/server';
import { completeTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';
import { sequelize } from '@/lib/db/connection';

/**
 * POST /api/tasks/[taskId]/complete
 * Complete a task (works for both research and admin tasks)
 * - Managers can complete any task
 * - Researchers can complete tasks assigned to them
 * - Uses transaction to ensure progress calculation is atomic
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  // Use transaction to ensure task completion and progress update are atomic
  const transaction = await sequelize.transaction();

  try {
    const user = await getAuthenticatedUser(request);
    const taskId = parseInt(params.taskId, 10);

    if (isNaN(taskId)) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid task ID' },
        { status: 400 }
      );
    }

    // Complete task and recalculate progress within transaction
    // Progress is only calculated for research tasks with studies
    const task = await completeTask(taskId, user, transaction);

    // Commit transaction
    await transaction.commit();

    return NextResponse.json({ data: task });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
