// API route wrapper for auth and RBAC

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthenticatedRequest } from '@/lib/auth/middleware';
import { requirePermission } from '@/lib/rbac/guards';
import { RBACOptions } from '@/types/rbac';
import { AuthenticationError, PermissionError, ValidationError, NotFoundError } from '@/lib/utils/errors';

type RouteHandler = (
  req: AuthenticatedRequest,
  context?: { params: Promise<Record<string, string>> | Record<string, string> }
) => Promise<NextResponse>;

interface RouteOptions {
  requireAuth?: boolean; // Default: true
  requirePermission?: RBACOptions & { 
    // Resource ID can be extracted from URL params
    // Use paramName to specify which param contains the resource ID
    // e.g., { paramName: 'taskId' } for /api/tasks/[taskId]/complete
    paramName?: string;
    // Or provide resourceId directly (for non-URL-based resources)
    resourceId?: number;
  };
}

/**
 * Extract resource ID from URL params based on resource type
 * Maps common param names to resource IDs
 */
async function extractResourceId(
  resource: string,
  params: Promise<Record<string, string>> | Record<string, string> | undefined,
  options: RouteOptions['requirePermission']
): Promise<number | undefined> {
  // Await params if it's a Promise (Next.js 16+)
  const resolvedParams = params instanceof Promise ? await params : params;
  // If resourceId is explicitly provided, use it
  if (options?.resourceId) {
    return options.resourceId;
  }

  if (!resolvedParams) return undefined;

  // Try to extract from specified param name
  if (options?.paramName && resolvedParams[options.paramName]) {
    const id = parseInt(resolvedParams[options.paramName], 10);
    return isNaN(id) ? undefined : id;
  }

  // Auto-detect common param names based on resource type
  const paramMap: Record<string, string[]> = {
    project: ['projectId', 'id'],
    study: ['studyId', 'id'],
    task: ['taskId', 'id'],
  };

  const possibleParams = paramMap[resource] || ['id'];
  for (const paramName of possibleParams) {
    if (resolvedParams[paramName]) {
      const id = parseInt(resolvedParams[paramName], 10);
      if (!isNaN(id)) return id;
    }
  }

  return undefined;
}

/**
 * Wrapper for API route handlers
 * Handles auth, RBAC, and error handling
 */
export function createRouteHandler(
  handler: RouteHandler,
  options: RouteOptions = {}
): RouteHandler {
  return async (req: NextRequest, context) => {
    try {
      // Authentication
      let authenticatedReq: AuthenticatedRequest;
      if (options.requireAuth !== false) {
        authenticatedReq = await authenticateRequest(req);
      } else {
        authenticatedReq = req as AuthenticatedRequest;
      }

      // RBAC Check
      if (options.requirePermission && authenticatedReq.user) {
        // Await params if it's a Promise (Next.js 16+)
        const resolvedParams = context?.params instanceof Promise 
          ? await context.params 
          : context?.params;
        
        // Extract resource ID from URL params if needed
        const resourceId = await extractResourceId(
          options.requirePermission.resource,
          resolvedParams,
          options.requirePermission
        );

        // Create RBAC options with resource ID
        const rbacOptions: RBACOptions & { resourceId?: number } = {
          resource: options.requirePermission.resource,
          action: options.requirePermission.action,
          requireOwnership: options.requirePermission.requireOwnership,
          resourceId,
        };

        await requirePermission(authenticatedReq.user, rbacOptions);
      }

      // Execute handler - ensure params is resolved if it's a Promise
      const resolvedContext = context?.params instanceof Promise
        ? { params: await context.params }
        : context;
      
      return await handler(authenticatedReq, resolvedContext);
    } catch (error) {
      // Error handling
      if (error instanceof AuthenticationError) {
        return NextResponse.json(
          { error: 'Unauthorized', message: error.message },
          { status: 401 }
        );
      }

      if (error instanceof PermissionError) {
        return NextResponse.json(
          { error: 'Forbidden', message: error.message },
          { status: 403 }
        );
      }

      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Bad Request', message: error.message },
          { status: 400 }
        );
      }

      if (error instanceof NotFoundError) {
        return NextResponse.json(
          { error: 'Not Found', message: error.message },
          { status: 404 }
        );
      }

      // Log server errors
      console.error('API Route Error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
  };
}

