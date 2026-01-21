// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete

import { NextRequest, NextResponse } from 'next/server';
import { completeTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';
import { sequelize } from '@/lib/db/connection';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete
 * Complete a task
 * - Managers can complete any task
 * - Researchers can complete tasks assigned to them
 * - Uses transaction to ensure progress calculation is atomic
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studyId: string; taskId: string }> }
) {
  // Use transaction to ensure task completion and progress update are atomic
  const transaction = await sequelize.transaction();

  try {
    const user = await getAuthenticatedUser(request);
    const { taskId: taskIdParam } = await params;
    const taskId = parseInt(taskIdParam, 10);

    if (isNaN(taskId)) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid task ID' },
        { status: 400 }
      );
    }

    // Complete task and recalculate progress within transaction
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

