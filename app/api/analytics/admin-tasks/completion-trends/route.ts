// API route: GET /api/analytics/admin-tasks/completion-trends

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';

/**
 * GET /api/analytics/admin-tasks/completion-trends
 * Get admin task completion trends over time
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!, 10)
      : null;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();
    const period = (searchParams.get('period') as 'day' | 'week' | 'month') || 'day';

    const trends = await analyticsService.getAdminTaskCompletionTrends(
      projectId,
      startDate,
      endDate,
      period,
      user
    );

    return NextResponse.json({ data: trends });
  } catch (error) {
    console.error('[Analytics Admin Tasks Completion Trends] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
