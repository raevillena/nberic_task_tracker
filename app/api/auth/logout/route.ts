// Logout API route - uses external authentication API

import { NextRequest, NextResponse } from 'next/server';
import { externalLogout } from '@/services/externalAuthService';

export async function POST(req: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.get('refreshToken')?.value;

    // Logout from external API if we have a refresh token
    if (refreshToken) {
      try {
        await externalLogout(refreshToken);
      } catch (error) {
        // Log error but continue to clear local cookies
        console.error('External logout error (continuing with local cleanup):', error);
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
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
    return response;
  }
}

