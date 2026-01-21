// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance/[flagId]/resolve

import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/complianceService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../../../../middleware';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance/[flagId]/resolve
 * Resolve a compliance flag (Manager only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studyId: string; taskId: string; flagId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { flagId: flagIdParam } = await params;
    const flagId = parseInt(flagIdParam, 10);

    if (isNaN(flagId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid flag ID' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const notes = body.notes || undefined;

    const flag = await complianceService.resolveComplianceFlag(flagId, { notes }, user);

    return NextResponse.json({ data: flag });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
