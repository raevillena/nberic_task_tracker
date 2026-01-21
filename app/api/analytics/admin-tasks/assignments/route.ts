// API route: GET /api/analytics/admin-tasks/assignments

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * GET /api/analytics/admin-tasks/assignments
 * Get admin task assignment metrics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!, 10)
      : null;

    const metrics = await analyticsService.getAdminTaskAssignmentMetrics(projectId, user);

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Admin Tasks Assignments] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
