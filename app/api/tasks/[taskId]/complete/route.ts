// Task complete API route

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandler } from '@/lib/api/routeWrapper';
import { completeTask } from '@/services/taskService';

// POST /api/tasks/[taskId]/complete - Mark task as complete
export const POST = createRouteHandler(
  async (req, context) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const taskId = parseInt(context?.params?.taskId || '0', 10);
    if (!taskId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid task ID' },
        { status: 400 }
      );
    }

    const task = await completeTask(taskId, req.user);
    return NextResponse.json(task);
  },
  {
    requireAuth: true,
    requirePermission: {
      resource: 'task',
      action: 'complete',
    },
  }
);

