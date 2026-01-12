// Auth Redux slice

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserRole } from '@/types/entities';
import { LoginRequest, LoginResponse } from '@/types/api';
import { decodeToken, AccessTokenPayload } from '@/lib/auth/jwt';

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
        const error = await response.json();
        return rejectWithValue(error.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();

      // Decode token to get expiry
      const payload = decodeToken(data.accessToken) as AccessTokenPayload;
      const tokenExpiry = payload ? payload.exp * 1000 : null; // Convert to milliseconds

      return {
        accessToken: data.accessToken,
        user: data.user,
        tokenExpiry,
      };
    } catch (error) {
      return rejectWithValue('Network error. Please try again.');
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
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

export const refreshTokenThunk = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        return rejectWithValue('Token refresh failed');
      }

      const data = await response.json();
      const payload = decodeToken(data.accessToken) as AccessTokenPayload;
      const tokenExpiry = payload ? payload.exp * 1000 : null;

      return {
        accessToken: data.accessToken,
        tokenExpiry,
      };
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

      if (storedToken && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const payload = decodeToken(storedToken) as AccessTokenPayload | null;

          // Check if token is still valid (not expired)
          if (payload && payload.exp * 1000 > Date.now()) {
            state.accessToken = storedToken;
            state.user = user;
            state.tokenExpiry = payload.exp * 1000;
            state.isAuthenticated = true;
          } else {
            // Token expired, clear storage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          }
        } catch (error) {
          // Invalid data, clear storage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
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

        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', action.payload.accessToken);
          localStorage.setItem('user', JSON.stringify(action.payload.user));
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

// Selectors
export const selectAccessToken = (state: { auth: AuthState }) => state.auth.accessToken;
export const selectAuthUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;