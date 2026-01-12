// API route: GET /api/analytics/completion-time

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/completion-time
 * Get average task completion time for researchers
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const researcherId = searchParams.get('researcherId')
      ? parseInt(searchParams.get('researcherId')!, 10)
      : null;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const metrics = await analyticsService.getAverageCompletionTime(
      researcherId,
      startDate,
      endDate,
      user
    );

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Completion Time] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
