// API route: GET /api/analytics/compliance-resolution

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/compliance-resolution
 * Get average compliance flag resolution time
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

    const metrics = await analyticsService.getAverageFlagResolutionTime(
      projectId,
      studyId,
      user
    );

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Compliance Resolution] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
