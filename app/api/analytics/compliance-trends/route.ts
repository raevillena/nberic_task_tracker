// API route: GET /api/analytics/compliance-trends

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/compliance-trends
 * Get compliance flag trends over time
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
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();
    const period = (searchParams.get('period') as 'day' | 'week' | 'month') || 'day';

    const metrics = await analyticsService.getComplianceFlagTrends(
      projectId,
      studyId,
      startDate,
      endDate,
      period,
      user
    );

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Compliance Trends] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
