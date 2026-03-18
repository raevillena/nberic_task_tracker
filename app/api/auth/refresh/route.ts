// Refresh token API route - uses external authentication API

import { NextRequest, NextResponse } from 'next/server';
import { externalRefreshToken } from '@/services/externalAuthService';
import { TokenSession } from '@/lib/db/models';
import { Op } from 'sequelize';
import { hashToken } from '@/lib/auth/tokenHash';

const REFRESH_TIMEOUT = 10000; // 10 seconds timeout

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
        { error: 'Unauthorized', message: 'No refresh token provided', code: 'REFRESH_TOKEN_MISSING' },
        { status: 401 }
      );
    }

    // Look up user id/role by refresh token hash (external API expects id, role in body)
    const refreshTokenHash = hashToken(refreshToken);
    let userId: number | undefined;
    let userRole: string | undefined;

    let session: Awaited<ReturnType<typeof TokenSession.findOne>> = null;
    try {
      session = await TokenSession.findOne({
        where: {
          refreshTokenHash,
          expiresAt: { [Op.gt]: new Date() },
        },
      });
      const data = session ? (session as { userData?: { id: number; apps?: Array<{ name: string; Roles?: { userType: string } }> } }).userData : undefined;
      if (data) {
        userId = data.id;
        const nttApp = data.apps?.find((app: { name: string }) => app.name === 'NTT');
        userRole = nttApp?.Roles?.userType || 'Researcher';
      }
    } catch (error) {
      // Continue and return 401 below
    }

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User session not found. Please login again.', code: 'SESSION_NOT_FOUND' },
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
      const isTimeout = error.message?.includes('timeout');
      const code = isTimeout ? 'REFRESH_TIMEOUT' : 'REFRESH_TOKEN_INVALID';
      const message = isTimeout ? 'Refresh request timed out' : 'Invalid or expired refresh token';
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized', message, code },
        { status: 401 }
      );
      if (!isTimeout) {
        errorResponse.cookies.delete('refreshToken');
        errorResponse.cookies.set('refreshToken', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 0,
          path: '/',
        });
      }
      return errorResponse;
    }

    // External auth returns { accessToken } and may optionally return a new refresh token
    const newAccessToken = refreshResponse.token?.accessToken || refreshResponse.accessToken;
    if (!newAccessToken) {
      throw new Error('No access token in refresh response');
    }

    // Update session with new access token hash so the next request (with this token) finds user data.
    // If the external API rotated the refresh token, also persist the new refresh token hash so future
    // refresh calls can still resolve the user session.
    const newRefreshToken = refreshResponse.token?.refreshToken || refreshResponse.refreshToken;

    if (session) {
      try {
        const updatePayload: { accessTokenHash: string; refreshTokenHash?: string | null } = {
          accessTokenHash: hashToken(newAccessToken),
        };

        if (newRefreshToken) {
          updatePayload.refreshTokenHash = hashToken(newRefreshToken);
        }

        await session.update(updatePayload);
      } catch (err) {
        console.error('[refresh] Failed to update session with new access token hash:', err);
      }
    }

    const response = NextResponse.json({ accessToken: newAccessToken });
    // Only set cookie if external API returned a new refresh token
    if (newRefreshToken) {
      response.cookies.set('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: refreshResponse.expiresIn ?? 14 * 24 * 60 * 60, // 14 days to match external
        path: '/',
      });
    }
    return response;
  } catch (error) {
    const errorResponse = NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or expired refresh token', code: 'REFRESH_TOKEN_INVALID' },
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

