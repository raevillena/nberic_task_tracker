// API route: GET /api/analytics/priority

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/priority
 * Get task priority distribution
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!, 10)
      : null;
    const studyId = searchParams.get('studyId')
      ? parseInt(searchParams.get('studyId')!, 10)
      : null;

    const distribution = await analyticsService.getTaskPriorityDistribution(
      projectId,
      studyId,
      user
    );

    return NextResponse.json({ data: distribution });
  } catch (error) {
    console.error('[Analytics Priority] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
