// API route: GET /api/task-requests/count - Get count of pending task requests

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';
import { TaskRequest } from '@/lib/db/models';
import { UserRole, TaskRequestStatus } from '@/types/entities';

/**
 * GET /api/task-requests/count
 * Get count of pending task requests
 * - Managers: See count of all pending requests
 * - Researchers: See count of their own pending requests
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const where: any = {
      status: TaskRequestStatus.PENDING,
    };

    // Researchers can only see their own requests
    if (user.role === UserRole.RESEARCHER) {
      where.requestedById = user.id;
    }

    const count = await TaskRequest.count({ where });

    return NextResponse.json({ count });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
