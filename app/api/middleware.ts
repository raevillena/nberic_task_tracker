// API middleware for authentication and RBAC

import { NextRequest, NextResponse } from 'next/server';
import { UserContext } from '@/types/rbac';
import { authenticateRequest, AuthenticatedRequest } from '@/lib/auth/middleware';
import { AuthenticationError } from '@/lib/utils/errors';

/**
 * Extract user context from request
 * Uses the actual authentication middleware
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<UserContext> {
  const authenticatedReq = await authenticateRequest(request);
  
  if (!authenticatedReq.user) {
    throw new AuthenticationError('User not authenticated');
  }
  
  return authenticatedReq.user;
}

/**
 * Create error response helper
 */
export function createErrorResponse(
  error: Error,
  statusCode: number = 500
): NextResponse {
  return NextResponse.json(
    {
      error: error.name,
      message: error.message,
    },
    { status: statusCode }
  );
}

/**
 * Map error types to HTTP status codes
 */
export function getErrorStatusCode(error: Error): number {
  if (error.name === 'AuthenticationError') return 401;
  if (error.name === 'PermissionError') return 403;
  if (error.name === 'NotFoundError') return 404;
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'DatabaseError') return 500;
  return 500;
}

