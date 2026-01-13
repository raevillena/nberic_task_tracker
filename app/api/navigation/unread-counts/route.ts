// API route: GET /api/navigation/unread-counts - Get unread counts for navigation badges

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';
import { getUnreadProjectCount } from '@/services/projectService';
import { getUnreadStudyCount } from '@/services/studyService';
import { getUnreadTaskCount } from '@/services/taskService';
import { UserRole } from '@/types/entities';

/**
 * GET /api/navigation/unread-counts
 * Get unread counts for projects, studies, and tasks (for researchers)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    // Only researchers see unread counts in navigation
    if (user.role !== UserRole.RESEARCHER) {
      return NextResponse.json({
        projects: 0,
        studies: 0,
        tasks: 0,
      });
    }

    // Get unread counts in parallel with error handling
    let projects = 0;
    let studies = 0;
    let tasks = 0;

    try {
      [projects, studies, tasks] = await Promise.all([
        getUnreadProjectCount(user.id).catch((err) => {
          console.error('[UnreadCounts] Error getting project count:', err);
          return 0;
        }),
        getUnreadStudyCount(user.id).catch((err) => {
          console.error('[UnreadCounts] Error getting study count:', err);
          return 0;
        }),
        getUnreadTaskCount(user.id, user.role).catch((err) => {
          console.error('[UnreadCounts] Error getting task count:', err);
          return 0;
        }),
      ]);
    } catch (error) {
      console.error('[UnreadCounts] Error in Promise.all:', error);
      // Continue with 0 values
    }

    // Debug logging
    console.log(`[UnreadCounts] User ${user.id} (${user.role}): projects=${projects}, studies=${studies}, tasks=${tasks}`);

    return NextResponse.json({
      projects,
      studies,
      tasks,
    });
  } catch (error: any) {
    console.error('[UnreadCounts] API route error:', error);
    console.error('[UnreadCounts] Error stack:', error?.stack);
    console.error('[UnreadCounts] Error message:', error?.message);
    console.error('[UnreadCounts] Error name:', error?.name);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
