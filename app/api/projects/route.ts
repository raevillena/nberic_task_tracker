// API route: GET /api/projects, POST /api/projects

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/services/projectService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../middleware';
import { CreateProjectRequest } from '@/types/api';

/**
 * GET /api/projects
 * Get all projects
 * - Managers: See all projects
 * - Researchers: See only projects with assigned tasks
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const projects = await projectService.getAllProjects(user);

    return NextResponse.json({ data: projects });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 * - Only Managers can create projects
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body: CreateProjectRequest = await request.json();

    const project = await projectService.createProject(body, user);

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
