// API route: GET /api/task-requests

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../middleware';
import { TaskRequest, Task, Study, Project, User } from '@/lib/db/models';
import { UserRole, TaskRequestStatus } from '@/types/entities';

/**
 * GET /api/task-requests
 * Get all task requests
 * - Managers: See all requests
 * - Researchers: See only their own requests
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const where: any = {};

    // Researchers can only see their own requests
    if (user.role === UserRole.RESEARCHER) {
      where.requestedById = user.id;
    }

    const requests = await TaskRequest.findAll({
      where,
      include: [
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'studyId'],
          include: [
            {
              model: Study,
              as: 'study',
              attributes: ['id', 'name', 'projectId'],
              include: [
                {
                  model: Project,
                  as: 'project',
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: 'requestedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        {
          model: User,
          as: 'requestedAssignedTo',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        {
          model: User,
          as: 'reviewedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return NextResponse.json({ data: requests });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
