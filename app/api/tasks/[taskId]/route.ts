// API route: GET /api/tasks/[taskId], PUT /api/tasks/[taskId], DELETE /api/tasks/[taskId]
// Handles standalone admin tasks and general task operations

import { NextRequest, NextResponse } from 'next/server';
import { getTaskById, updateTask, deleteTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';
import { UpdateTaskRequest } from '@/types/api';

/**
 * GET /api/tasks/[taskId]
 * Get a single task by ID (works for both research and admin tasks)
 */
export async function GET(
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

    const task = await getTaskById(taskId, user);

    return NextResponse.json({ data: task });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * PUT /api/tasks/[taskId]
 * Update a task
 * - Managers: Can update all fields
 * - Researchers: Can only update name, description, and status (not to completed)
 */
export async function PUT(
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

    const body: UpdateTaskRequest = await request.json();
    const task = await updateTask(taskId, body, user);

    return NextResponse.json({ data: task });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * DELETE /api/tasks/[taskId]
 * Delete a task (soft delete - moves to trash)
 * - Only Managers can delete tasks
 * - Tasks are not permanently deleted, just moved to trash
 */
export async function DELETE(
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

    await deleteTask(taskId, user);

    return NextResponse.json({ message: 'Task deleted successfully' }, { status: 200 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
