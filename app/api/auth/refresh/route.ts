// Refresh token API route

import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateAccessToken } from '@/lib/auth/jwt';
import { User } from '@/lib/db/models';
import { AuthenticationError } from '@/lib/utils/errors';

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

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Verify user exists and is active
    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User account is inactive' },
        { status: 401 }
      );
    }

    // Verify token version matches (for token invalidation)
    if (payload.tokenVersion !== user.tokenVersion) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Token has been revoked' },
        { status: 401 }
      );
    }

    // Generate new access token
    const accessToken = generateAccessToken(user.id, user.email, user.role);

    return NextResponse.json({ accessToken });
  } catch (error) {
    if (error instanceof AuthenticationError || (error as Error).message.includes('Token')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

