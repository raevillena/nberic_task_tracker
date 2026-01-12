// Tasks API route

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandler } from '@/lib/api/routeWrapper';
import { getTasksByStudy, createTask } from '@/services/taskService';
import { CreateTaskRequest } from '@/types/api';

// GET /api/studies/[studyId]/tasks - Get tasks for a study
export const GET = createRouteHandler(
  async (req, context) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studyId = parseInt(context?.params?.studyId || '0', 10);
    if (!studyId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const tasks = await getTasksByStudy(studyId, req.user);
    return NextResponse.json(tasks);
  },
  {
    requireAuth: true,
    requirePermission: {
      resource: 'task',
      action: 'read',
    },
  }
);

// POST /api/studies/[studyId]/tasks - Create a new task
export const POST = createRouteHandler(
  async (req, context) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studyId = parseInt(context?.params?.studyId || '0', 10);
    if (!studyId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const body: CreateTaskRequest = await req.json();
    const task = await createTask(studyId, body, req.user);
    return NextResponse.json(task, { status: 201 });
  },
  {
    requireAuth: true,
    requirePermission: {
      resource: 'task',
      action: 'create',
    },
  }
);

