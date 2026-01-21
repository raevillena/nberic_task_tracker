// IsAuthenticated API route - uses external authentication API

import { NextRequest, NextResponse } from 'next/server';
import { externalIsAuthenticated } from '@/services/externalAuthService';

export async function GET(req: NextRequest) {
  try {
    // Extract access token from Authorization header
    const authHeader = req.headers.get('Authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      return NextResponse.json(
        { isAuthenticated: false, message: 'No access token provided' },
        { status: 401 }
      );
    }

    // Get refresh token from cookie (required by external API)
    const refreshToken = req.cookies.get('refreshToken')?.value;

    // Check authentication status with external API
    // If externalIsAuthenticated returns successfully (status 200), the token is valid
    const authStatus = await externalIsAuthenticated(accessToken, refreshToken);

    // If we got here without an error, the external API returned status 200, so user is authenticated
    const isAuthenticated = true;

    // Extract role from apps array if user data is provided
    let userRole: string | undefined;
    if (authStatus.user?.apps) {
      const nttApp = authStatus.user.apps.find((app) => app.name === 'NTT');
      userRole = nttApp?.Roles?.userType;
    }

    return NextResponse.json({
      isAuthenticated,
      user: authStatus.user
        ? {
            id: authStatus.user.id,
            email: authStatus.user.email,
            firstName: authStatus.user.firstName,
            lastName: authStatus.user.lastName,
            role: userRole,
          }
        : undefined,
    });
  } catch (error) {
    console.error('IsAuthenticated error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    return NextResponse.json(
      { 
        isAuthenticated: false, 
        error: 'Internal Server Error', 
        message: errorMessage 
      },
      { status: 500 }
    );
  }
}
