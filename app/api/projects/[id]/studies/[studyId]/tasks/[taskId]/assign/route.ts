// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/assign

import { NextRequest, NextResponse } from 'next/server';
import { assignTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/assign
 * Assign a task to a researcher
 * - Only Managers can assign tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string; taskId: string } }
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

    const body: { assignedToId: number } = await request.json();

    if (!body.assignedToId || isNaN(body.assignedToId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'assignedToId is required and must be a valid number' },
        { status: 400 }
      );
    }

    const task = await assignTask(taskId, body.assignedToId, user);

    return NextResponse.json({ data: task });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

