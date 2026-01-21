// Refresh token API route - uses external authentication API

import { NextRequest, NextResponse } from 'next/server';
import { externalRefreshToken } from '@/services/externalAuthService';
import { TokenSession } from '@/lib/db/models';
import { Op } from 'sequelize';
import crypto from 'crypto';

const REFRESH_TIMEOUT = 10000; // 10 seconds timeout

/**
 * Hash a refresh token (same algorithm as access tokens)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Refresh request timeout')), ms);
  });
}

export async function POST(req: NextRequest) {
  try {
    // Extract refresh token from cookie
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // Try to get user info from token_sessions table
    // Look up by refresh token hash (if we stored it) or by most recent non-expired session
    // For now, we'll try to find the most recent non-expired session
    // TODO: Add refreshTokenHash to token_sessions table and look up by that
    let userId: number | undefined;
    let userRole: string | undefined;
    
    try {
      // Try to find a recent non-expired session to get user info
      // This is a workaround until we add refreshTokenHash to the table
      const recentSession = await TokenSession.findOne({
        where: {
          expiresAt: {
            [Op.gt]: new Date(), // Not expired
          },
        },
        order: [['createdAt', 'DESC']], // Most recent first
        limit: 1,
      });

      if (recentSession?.userData) {
        userId = recentSession.userData.id;
        // Extract role from apps array
        const nttApp = recentSession.userData.apps?.find((app: any) => app.name === 'NTT');
        userRole = nttApp?.Roles?.userType || 'Researcher';
      }
    } catch (error) {
      // Continue without user info - external API might still work
    }

    // If we don't have user info, we can't refresh (external API requires id and role)
    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User session not found. Please login again.' },
        { status: 401 }
      );
    }

    // Refresh token with external API (with timeout protection)
    let refreshResponse: Awaited<ReturnType<typeof externalRefreshToken>>;
    try {
      refreshResponse = await Promise.race([
        externalRefreshToken(refreshToken, userId, userRole),
        createTimeoutPromise(REFRESH_TIMEOUT),
      ]);
    } catch (error: any) {
      // Handle timeout or other errors
      const errorResponse = NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: error.message?.includes('timeout') 
            ? 'Refresh request timed out' 
            : 'Invalid or expired refresh token' 
        },
        { status: 401 }
      );
      
      // Clear invalid refresh token cookie
      errorResponse.cookies.delete('refreshToken');
      errorResponse.cookies.set('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
      
      return errorResponse;
    }

    // Handle different response structures (token object or direct properties)
    const newAccessToken = refreshResponse.token?.accessToken || refreshResponse.accessToken;
    const newRefreshToken = refreshResponse.token?.refreshToken || refreshResponse.refreshToken;

    if (!newAccessToken) {
      throw new Error('No access token in refresh response');
    }

    // Update refresh token cookie if a new one is provided
    const response = NextResponse.json({
      accessToken: newAccessToken,
    });

    if (newRefreshToken) {
      response.cookies.set('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: refreshResponse.expiresIn || 7 * 24 * 60 * 60, // Use expiresIn from API or default to 7 days
        path: '/',
      });
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    // Clear invalid refresh token cookie
    const errorResponse = NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or expired refresh token' },
      { status: 401 }
    );
    
    errorResponse.cookies.delete('refreshToken');
    errorResponse.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return errorResponse;
  }
}

