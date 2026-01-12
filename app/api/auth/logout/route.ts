// Logout API route

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';

export async function POST(req: NextRequest) {
  try {
    // Try to authenticate to get user (optional - logout should work even if token expired)
    let userId: number | null = null;
    try {
      const authenticatedReq = await authenticateRequest(req);
      if (authenticatedReq.user) {
        userId = authenticatedReq.user.id;
      }
    } catch (error) {
      // Auth failed, but we still want to clear cookies
      // This handles cases where token is expired but user wants to logout
    }

    // If we have a user, increment tokenVersion to invalidate all refresh tokens
    // This ensures logout invalidates all sessions across devices
    if (userId) {
      const user = await User.findByPk(userId);
      if (user) {
        await user.update({ tokenVersion: user.tokenVersion + 1 });
      }
    }

    // Clear refresh token cookie
    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.delete('refreshToken');
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, clear the cookie
    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.delete('refreshToken');
    return response;
  }
}

