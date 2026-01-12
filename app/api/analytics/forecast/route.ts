// API route: GET /api/analytics/forecast

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/forecast
 * Get study completion forecasts
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const studyId = searchParams.get('studyId')
      ? parseInt(searchParams.get('studyId')!, 10)
      : null;

    const metrics = await analyticsService.getStudyCompletionForecast(
      studyId,
      user
    );

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Forecast] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
