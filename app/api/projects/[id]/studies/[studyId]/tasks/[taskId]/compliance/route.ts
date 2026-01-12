// API route: GET /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance, POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance

import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/complianceService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';

/**
 * GET /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance
 * Get all compliance flags for a task
 */
export async function GET(
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

    const flags = await complianceService.getComplianceFlagsByTask(taskId, user);

    return NextResponse.json({ data: flags });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance
 * Create a compliance flag for a task
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

    const body: {
      flagType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    } = await request.json();

    const flag = await complianceService.createComplianceFlag(taskId, body, user);

    return NextResponse.json({ data: flag }, { status: 201 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

