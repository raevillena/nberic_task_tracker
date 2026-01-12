// API route: GET /api/analytics/projects

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/analytics/projects
 * Get project progress metrics
 * - Managers: See all projects
 * - Researchers: See only projects with assigned tasks
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!, 10)
      : null;

    const metrics = await analyticsService.getProjectProgress(projectId, user);

    // Debug logging
    console.log(`[Analytics Projects] User: ${user.role} (${user.id}), Found ${metrics.length} projects`);

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[Analytics Projects] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
