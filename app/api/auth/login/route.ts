// Login API route - uses external authentication API
// NOTE: This app uses external API (umans-api.nbericmmsu.com) as the sole provider of users.
// Local user creation/authentication is not supported.

import { NextRequest, NextResponse } from 'next/server';
import { externalLogin } from '@/services/externalAuthService';
import { syncUserFromExternalApi } from '@/services/userService';
import { UserRole } from '@/types/entities';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Authenticate with external API
    const authResponse = await externalLogin(email, password);

    // Extract role from apps array (find app with name "NTT")
    const nttApp = authResponse.user.apps?.find((app) => app.name === 'NTT');
    const userRole = nttApp?.Roles?.userType || 'Researcher'; // Default to Researcher if not found

    // Sync user to local database (creates if doesn't exist, updates if exists)
    // This ensures we have a local user record with the correct ID for database queries
    // Messages and other database records use local database IDs, not external API IDs
    const localUser = await syncUserFromExternalApi({
      email: authResponse.user.email,
      firstName: authResponse.user.firstName,
      lastName: authResponse.user.lastName,
      role: userRole as UserRole, // Map to UserRole enum
    });

    // Create response with access token and user data
    // IMPORTANT: Return local database ID, not external API ID
    // This ensures consistency with messages and other database records
    const response = NextResponse.json({
      accessToken: authResponse.token.accessToken,
      user: {
        id: localUser.id, // Use local database ID, not external API ID
        email: localUser.email,
        firstName: localUser.firstName,
        lastName: localUser.lastName,
        role: localUser.role, // Use role from local database
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[login] Response created:', {
        hasAccessToken: !!authResponse.token.accessToken,
        userId: authResponse.user.id,
        role: userRole,
        settingRefreshCookie: !!authResponse.token.refreshToken,
      });
    }

    // Set refresh token as httpOnly cookie
    if (authResponse.token.refreshToken) {
      response.cookies.set('refreshToken', authResponse.token.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days (adjust if API provides expiresIn)
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle specific error cases with user-friendly messages
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    // Determine status code and user-friendly message based on error
    let status = 500;
    let userMessage = 'An unexpected error occurred. Please try again later.';
    
    if (errorMessage.includes('Invalid') || errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
      status = 401;
      userMessage = 'Invalid email or password. Please check your credentials and try again.';
    } else if (errorMessage.includes('Bad Request') || errorMessage.includes('required') || errorMessage.includes('400')) {
      status = 400;
      userMessage = 'Please enter both email and password.';
    } else if (errorMessage.includes('Network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
      status = 503;
      userMessage = 'Unable to connect to authentication service. Please try again later.';
    } else if (errorMessage.includes('timeout')) {
      status = 504;
      userMessage = 'Request timed out. Please try again.';
    }

    return NextResponse.json(
      { error: status === 401 ? 'Unauthorized' : status >= 500 ? 'Internal Server Error' : 'Bad Request', message: userMessage },
      { status }
    );
  }
}

