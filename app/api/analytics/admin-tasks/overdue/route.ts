// API route: GET /api/analytics/admin-tasks/overdue

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * GET /api/analytics/admin-tasks/overdue
 * Get overdue admin tasks
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!, 10)
      : null;

    const overdueTasks = await analyticsService.getOverdueAdminTasks(projectId, user);

    return NextResponse.json({ data: overdueTasks });
  } catch (error) {
    console.error('[Analytics Admin Tasks Overdue] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
