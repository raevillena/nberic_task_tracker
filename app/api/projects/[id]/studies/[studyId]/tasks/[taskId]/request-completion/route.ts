// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/request-completion

import { NextRequest, NextResponse } from 'next/server';
import { requestTaskCompletion } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';
import { emitTaskRequestCreated } from '@/lib/socket/taskRequestEvents';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/request-completion
 * Request task completion (Researcher only)
 * - Creates a pending completion request for manager approval
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

    const body = await request.json().catch(() => ({}));
    const notes = body.notes || undefined;

    const taskRequest = await requestTaskCompletion(taskId, user, notes);

    // #region agent log
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
    try {
      // Type assertion needed because Sequelize relations aren't in the model type
      const taskRequestData = taskRequest as any;
      const taskData = taskRequestData.task;
      fs.appendFileSync(logPath, `[REQUEST-COMPLETION-ROUTE] Request created, about to emit: requestId=${taskRequest.id}, task.createdById=${taskData?.createdById}, task.study.projectId=${taskData?.study?.projectId}\n`);
    } catch {}
    // #endregion

    // Emit socket event to notify managers
    // Don't await to avoid blocking the response
    emitTaskRequestCreated(taskRequest).catch((err) => {
      // #region agent log
      try {
        fs.appendFileSync(logPath, `[REQUEST-COMPLETION-ROUTE] Failed to emit: ${err?.message || err}\n`);
      } catch {}
      // #endregion
      console.error('Failed to emit task-request:created event:', err);
    });

    return NextResponse.json({ data: taskRequest });
  } catch (error: any) {
    // #region agent log
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
    try {
      fs.appendFileSync(logPath, `[REQUEST-COMPLETION] ERROR: ${error?.message || error}\nStack: ${error?.stack || 'N/A'}\n`);
    } catch {}
    // #endregion
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
