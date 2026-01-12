// API route: GET /api/analytics/compliance

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/compliance
 * Get compliance flag rate metrics
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
    const severity = searchParams.get('severity') || null;

    const metrics = await analyticsService.getComplianceFlagRate(
      projectId,
      studyId,
      user,
      severity
    );

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Compliance] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
