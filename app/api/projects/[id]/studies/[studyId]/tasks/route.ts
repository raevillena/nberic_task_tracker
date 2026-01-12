// API route: GET /api/projects/[id]/studies/[studyId]/tasks, POST /api/projects/[id]/studies/[studyId]/tasks

import { NextRequest, NextResponse } from 'next/server';
import { getTasksByStudy, createTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../middleware';
import { CreateTaskRequest } from '@/types/api';

/**
 * GET /api/projects/[id]/studies/[studyId]/tasks
 * Get all tasks for a study
 * - Managers: See all tasks
 * - Researchers: See only assigned tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const studyId = parseInt(params.studyId, 10);

    if (isNaN(studyId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const tasks = await getTasksByStudy(studyId, user);

    return NextResponse.json({ data: tasks });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks
 * Create a new task
 * - Only Managers can create tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const studyId = parseInt(params.studyId, 10);

    if (isNaN(studyId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const body: CreateTaskRequest = await request.json();
    const task = await createTask(studyId, body, user);

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

