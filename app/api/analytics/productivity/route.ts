// API route: GET /api/analytics/productivity

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';
import { UserRole } from '@/types/entities';

/**
 * GET /api/analytics/productivity
 * Get researcher productivity metrics
 * - Managers: Can view all researchers or specific researcher
 * - Researchers: Can only view their own metrics
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
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const metrics = await analyticsService.getResearcherCompletionRate(
      researcherId,
      startDate,
      endDate,
      user
    );

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Productivity] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
