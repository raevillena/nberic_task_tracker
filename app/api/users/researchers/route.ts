// API route: GET /api/users/researchers
// Get all active researchers for task assignment

import { NextRequest, NextResponse } from 'next/server';
import { getResearchers } from '@/services/userService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';

/**
 * GET /api/users/researchers
 * Get all active researchers
 * - Only authenticated users can access
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const researchers = await getResearchers();

    return NextResponse.json({ data: researchers });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
