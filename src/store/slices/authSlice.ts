// Auth Redux slice

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserRole } from '@/types/entities';
import { LoginRequest, LoginResponse } from '@/types/api';
import { decodeToken, AccessTokenPayload } from '@/lib/auth/jwt';
import { resetSessionExpiredNotificationFlag } from '@/lib/utils/sessionNotification';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  tokenExpiry: number | null; // Unix timestamp in milliseconds
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isRefreshing: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  tokenExpiry: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isRefreshing: false,
};

// Async thunks
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        let errorMessage = 'Login failed. Please try again.';
        
        try {
          const error = await response.json();
          
          // Map API error messages to user-friendly messages
          if (response.status === 401) {
            if (error.message?.toLowerCase().includes('invalid') || 
                error.message?.toLowerCase().includes('unauthorized') ||
                error.message?.toLowerCase().includes('credentials')) {
              errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else {
              errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            }
          } else if (response.status === 400) {
            if (error.message?.toLowerCase().includes('required')) {
              errorMessage = 'Please enter both email and password.';
            } else {
              errorMessage = error.message || 'Invalid request. Please check your input.';
            }
          } else if (response.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.message) {
            // Use the API's error message if it's user-friendly
            errorMessage = error.message;
          }
        } catch (parseError) {
          // If we can't parse the error response, use status-based messages
          if (response.status === 401) {
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          } else if (response.status === 400) {
            errorMessage = 'Invalid request. Please check your input.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          }
        }
        
        return rejectWithValue(errorMessage);
      }

      const data: LoginResponse = await response.json();

      // Decode token to get expiry (external API tokens may not be JWTs)
      // If decoding fails, set expiry to null and let the API handle validation
      let tokenExpiry: number | null = null;
      try {
        const payload = decodeToken(data.accessToken) as AccessTokenPayload | null;
        if (payload && payload.exp) {
          tokenExpiry = payload.exp * 1000; // Convert to milliseconds
        }
      } catch (error) {
        // Token is not a JWT (likely from external API), that's okay
        // We'll rely on the external API to validate it
        console.debug('Token is not a JWT format (expected for external API)');
      }

      return {
        accessToken: data.accessToken,
        user: data.user,
        tokenExpiry,
      };
    } catch (error) {
      // Network errors or other fetch failures
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return rejectWithValue('Unable to connect to server. Please check your internet connection and try again.');
      }
      return rejectWithValue('An unexpected error occurred. Please try again.');
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      // Disconnect socket before logout
      const { disconnectSocket } = await import('@/lib/socket/client');
      disconnectSocket();

      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      dispatch(authSlice.actions.logout());
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }
);

const REFRESH_TIMEOUT = 10000; // 10 seconds timeout

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Refresh request timeout')), ms);
  });
}

export const refreshTokenThunk = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT);

      try {
        const response = await Promise.race([
          fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            signal: controller.signal,
          }),
          createTimeoutPromise(REFRESH_TIMEOUT),
        ]) as Response;

        clearTimeout(timeoutId);

        if (!response.ok) {
          return rejectWithValue('Token refresh failed');
        }

        const data = await response.json();
        
        // Decode token to get expiry (external API tokens may not be JWTs)
        let tokenExpiry: number | null = null;
        try {
          const payload = decodeToken(data.accessToken) as AccessTokenPayload | null;
          if (payload && payload.exp) {
            tokenExpiry = payload.exp * 1000; // Convert to milliseconds
          }
        } catch (error) {
          // Token is not a JWT (likely from external API), that's okay
          console.debug('Token is not a JWT format (expected for external API)');
        }

        return {
          accessToken: data.accessToken,
          tokenExpiry,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Handle timeout or abort errors
        if (error.name === 'AbortError' || error.message === 'Refresh request timeout') {
          return rejectWithValue('Token refresh timeout');
        }
        
        return rejectWithValue('Token refresh failed');
      }
    } catch (error) {
      return rejectWithValue('Token refresh failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{
      accessToken: string;
      user: User;
      tokenExpiry: number | null;
    }>) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.tokenExpiry = action.payload.tokenExpiry;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;

      // Persist to localStorage (backup)
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', action.payload.accessToken);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      }
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.tokenExpiry = null;
      state.isAuthenticated = false;
      state.error = null;
      
      // Reset session expired notification flag on logout
      resetSessionExpiredNotificationFlag();

      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    },
    refreshTokenStart: (state) => {
      state.isRefreshing = true;
    },
    refreshTokenSuccess: (state, action: PayloadAction<{
      accessToken: string;
      tokenExpiry: number | null;
    }>) => {
      state.accessToken = action.payload.accessToken;
      state.tokenExpiry = action.payload.tokenExpiry;
      state.isRefreshing = false;

      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', action.payload.accessToken);
      }
    },
    refreshTokenFailure: (state) => {
      state.isRefreshing = false;
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.tokenExpiry = null;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    },
    initializeAuth: (state) => {
      if (typeof window === 'undefined') return;

      const storedToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (process.env.NODE_ENV === 'development') {
        console.log('[authSlice] initializeAuth:', {
          hasStoredToken: !!storedToken,
          hasStoredUser: !!storedUser,
          tokenLength: storedToken?.length || 0,
        });
      }

      if (storedToken && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          
          // Try to decode token to check expiry (external API tokens may not be JWTs)
          let tokenExpiry: number | null = null;
          let isTokenValid = true;
          
          try {
            const payload = decodeToken(storedToken) as AccessTokenPayload | null;
            if (payload && payload.exp) {
              tokenExpiry = payload.exp * 1000;
              // Check if token is still valid (not expired)
              isTokenValid = tokenExpiry > Date.now();
            }
          } catch (error) {
            // Token is not a JWT (likely from external API), assume it's valid
            // The external API will validate it on the server side
            if (process.env.NODE_ENV === 'development') {
              console.debug('[authSlice] Token is not a JWT format (expected for external API)');
            }
          }

          if (isTokenValid) {
            state.accessToken = storedToken;
            state.user = user;
            state.tokenExpiry = tokenExpiry;
            state.isAuthenticated = true;
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[authSlice] Auth initialized from localStorage:', {
                hasToken: true,
                userId: user.id,
                email: user.email,
                role: user.role,
              });
            }
          } else {
            // Token expired, clear storage
            if (process.env.NODE_ENV === 'development') {
              console.log('[authSlice] Token expired, clearing storage');
            }
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          }
        } catch (error) {
          // Invalid data, clear storage
          if (process.env.NODE_ENV === 'development') {
            console.error('[authSlice] Error parsing stored auth data:', error);
          }
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[authSlice] No stored auth data found');
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.user = action.payload.user;
        state.tokenExpiry = action.payload.tokenExpiry;
        state.isAuthenticated = true;
        state.isLoading = false;
        state.error = null;
        
        // Reset session expired notification flag on successful login
        resetSessionExpiredNotificationFlag();

        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', action.payload.accessToken);
          localStorage.setItem('user', JSON.stringify(action.payload.user));
          
          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log('[authSlice] Login successful, token stored:', {
              hasToken: !!action.payload.accessToken,
              tokenLength: action.payload.accessToken.length,
              tokenPreview: `${action.payload.accessToken.substring(0, 20)}...`,
              userId: action.payload.user.id,
              email: action.payload.user.email,
              role: action.payload.user.role,
              storedInLocalStorage: true,
            });
          }
        }
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      .addCase(refreshTokenThunk.pending, (state) => {
        state.isRefreshing = true;
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.tokenExpiry = action.payload.tokenExpiry;
        state.isRefreshing = false;

        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', action.payload.accessToken);
        }
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        state.isRefreshing = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.tokenExpiry = null;

        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
      });
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, initializeAuth } = authSlice.actions;
export default authSlice.reducer;

// Selectors with safety checks
export const selectAccessToken = (state: { auth?: AuthState }) => state.auth?.accessToken ?? null;
export const selectAuthUser = (state: { auth?: AuthState }) => state.auth?.user ?? null;
export const selectIsAuthenticated = (state: { auth?: AuthState }) => state.auth?.isAuthenticated ?? false;
export const selectAuthIsLoading = (state: { auth?: AuthState }) => state.auth?.isLoading ?? false;
export const selectAuthError = (state: { auth?: AuthState }) => state.auth?.error ?? null;