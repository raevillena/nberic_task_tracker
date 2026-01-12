// API route: GET /api/analytics/workload

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/workload
 * Get current workload distribution across researchers
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const workload = await analyticsService.getResearcherWorkload(user);

    return NextResponse.json({ data: workload });
  } catch (error) {
    console.error('[Analytics Workload] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
