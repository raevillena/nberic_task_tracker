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
        getUnreadProjectCount(user.id).catch(() => 0),
        getUnreadStudyCount(user.id).catch(() => 0),
        getUnreadTaskCount(user.id, user.role).catch(() => 0),
      ]);
    } catch (error) {
      // Continue with 0 values
    }

    return NextResponse.json({
      projects,
      studies,
      tasks,
    });
  } catch (error: any) {
    console.error('[UnreadCounts] Error:', error);
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
