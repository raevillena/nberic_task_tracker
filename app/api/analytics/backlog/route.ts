// API route: GET /api/analytics/backlog

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/backlog
 * Get high-priority task backlog
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const backlog = await analyticsService.getHighPriorityBacklog(user);

    return NextResponse.json({ data: backlog });
  } catch (error) {
    console.error('[Analytics Backlog] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
