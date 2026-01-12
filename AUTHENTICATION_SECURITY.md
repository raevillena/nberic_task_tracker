# Authentication & Security Design
## NBERIC Task Tracker - JWT Authentication & RBAC System

---

## Table of Contents
1. [JWT Authentication Flow](#1-jwt-authentication-flow)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control-rbac)
3. [API Route Middleware Strategy](#3-api-route-middleware-strategy)
4. [Redux Auth State Flow](#4-redux-auth-state-flow)
5. [Token Refresh Strategy](#5-token-refresh-strategy)
6. [Security Considerations](#6-security-considerations)

---

## 1. JWT Authentication Flow

### 1.1 Token Structure

#### Access Token (Short-lived)
```typescript
// JWT Payload Structure
interface AccessTokenPayload {
  userId: number;
  email: string;
  role: 'Manager' | 'Researcher';
  iat: number;  // Issued at (seconds since epoch)
  exp: number;  // Expiration (seconds since epoch)
  type: 'access';
}

// Token Configuration
const ACCESS_TOKEN_CONFIG = {
  expiresIn: '15m',  // 15 minutes
  algorithm: 'HS256',
  issuer: 'nberic-task-tracker',
  audience: 'nberic-client',
};
```

#### Refresh Token (Long-lived)
```typescript
// JWT Payload Structure
interface RefreshTokenPayload {
  userId: number;
  tokenVersion: number;  // For token invalidation
  iat: number;
  exp: number;
  type: 'refresh';
}

// Token Configuration
const REFRESH_TOKEN_CONFIG = {
  expiresIn: '7d',  // 7 days
  algorithm: 'HS256',
  issuer: 'nberic-task-tracker',
  audience: 'nberic-client',
};
```

**Token Version Strategy**: Increment `tokenVersion` in User model when:
- User changes password
- User is deactivated
- Security breach detected
- Manual token revocation needed

### 1.2 Login Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. POST /api/auth/login
       │    { email, password }
       │
       ▼
┌─────────────────────┐
│  API Route Handler  │
│  /api/auth/login    │
└──────┬──────────────┘
       │
       │ 2. Validate input
       │ 3. Find user by email
       │ 4. Verify password (bcrypt)
       │ 5. Check isActive === true
       │
       ▼
┌─────────────────────┐
│  Auth Service       │
│  generateTokens()   │
└──────┬──────────────┘
       │
       │ 6. Generate access token
       │ 7. Generate refresh token
       │ 8. Update user.lastLoginAt
       │
       ▼
┌─────────────────────┐
│  Response           │
│  {                  │
│    accessToken,     │
│    refreshToken,    │
│    user: {          │
│      id,            │
│      email,         │
│      firstName,     │
│      lastName,      │
│      role           │
│    }                │
│  }                  │
└──────┬──────────────┘
       │
       │ 9. Set httpOnly cookie (refreshToken)
       │ 10. Return accessToken in response body
       │
       ▼
┌─────────────┐
│   Client    │
│  (Browser)  │
└─────────────┘
```

#### Pseudocode: Login Endpoint

```typescript
// app/api/auth/login/route.ts

POST /api/auth/login
Request Body: { email: string, password: string }

1. Validate request body (email format, password not empty)
2. Find user by email (case-insensitive)
   - If not found → 401 Unauthorized
3. Verify password using bcrypt.compare()
   - If invalid → 401 Unauthorized
4. Check user.isActive === true
   - If false → 403 Forbidden (account disabled)
5. Generate tokens:
   - accessToken = jwt.sign({ userId, email, role, type: 'access' }, SECRET, { expiresIn: '15m' })
   - refreshToken = jwt.sign({ userId, tokenVersion: user.tokenVersion, type: 'refresh' }, SECRET, { expiresIn: '7d' })
6. Update user.lastLoginAt = new Date()
7. Set refreshToken as httpOnly cookie:
   - httpOnly: true
   - secure: true (HTTPS only in production)
   - sameSite: 'strict'
   - maxAge: 7 days
8. Return response:
   - Status: 200 OK
   - Body: { accessToken, user: { id, email, firstName, lastName, role } }
   - Cookie: refreshToken (httpOnly)
```

### 1.3 Token Storage Strategy

#### Client-Side Storage
```typescript
// Access Token: Memory (Redux state) + localStorage backup
// - Primary: Redux store (in-memory, cleared on refresh)
// - Backup: localStorage (for page refresh persistence)
// - NEVER in cookies (XSS risk)

// Refresh Token: httpOnly Cookie ONLY
// - NOT in localStorage
// - NOT in sessionStorage
// - NOT accessible via JavaScript
// - Automatically sent with requests
```

**Rationale**:
- Access token in memory/Redux: Fast access, cleared on tab close
- Access token backup in localStorage: Persists across page refreshes
- Refresh token in httpOnly cookie: Protected from XSS, automatically sent

### 1.4 Request Authentication Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP Request
       │ Authorization: Bearer <accessToken>
       │ Cookie: refreshToken=<token>
       │
       ▼
┌─────────────────────┐
│  Next.js Middleware │
│  (app/middleware.ts) │
└──────┬──────────────┘
       │
       │ Extract token from Authorization header
       │
       ▼
┌─────────────────────┐
│  Auth Middleware     │
│  verifyToken()       │
└──────┬──────────────┘
       │
       ├─► Token Valid?
       │   ├─► YES → Attach user to request
       │   │         Continue to route handler
       │   │
       │   └─► NO → Check refresh token
       │           ├─► Refresh token valid?
       │           │   ├─► YES → Issue new access token
       │           │   │         Continue with new token
       │           │   │
       │           │   └─► NO → 401 Unauthorized
       │           │           Redirect to /login
       │           │
       │           └─► No refresh token → 401 Unauthorized
       │
       ▼
┌─────────────────────┐
│  Route Handler      │
│  (with user context)│
└─────────────────────┘
```

---

## 2. Role-Based Access Control (RBAC)

### 2.1 Role Definitions

```typescript
enum UserRole {
  MANAGER = 'Manager',
  RESEARCHER = 'Researcher',
}

// Permission Matrix
interface PermissionMatrix {
  [resource: string]: {
    [action: string]: UserRole[];
  };
}

const PERMISSIONS: PermissionMatrix = {
  project: {
    create: ['Manager'],
    read: ['Manager', 'Researcher'],  // Researcher: assigned only
    update: ['Manager'],
    delete: ['Manager'],
  },
  study: {
    create: ['Manager'],
    read: ['Manager', 'Researcher'],  // Researcher: assigned only
    update: ['Manager'],
    delete: ['Manager'],
  },
  task: {
    create: ['Manager'],
    read: ['Manager', 'Researcher'],  // Researcher: assigned only
    update: ['Manager', 'Researcher'],  // Researcher: limited fields
    complete: ['Manager'],  // CRITICAL: Only Manager
    assign: ['Manager'],
    delete: ['Manager'],
  },
};
```

### 2.2 Permission Check Functions

```typescript
// src/lib/rbac/permissions.ts

/**
 * Check if user has permission for resource action
 */
function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string
): boolean {
  const allowedRoles = PERMISSIONS[resource]?.[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Check if user can access resource (ownership/assignment check)
 */
async function canAccessResource(
  userId: number,
  userRole: UserRole,
  resourceType: 'project' | 'study' | 'task',
  resourceId: number
): Promise<boolean> {
  if (userRole === UserRole.MANAGER) {
    // Managers can access all resources
    return true;
  }

  // Researchers can only access assigned resources
  switch (resourceType) {
    case 'task':
      const task = await Task.findByPk(resourceId);
      return task?.assignedToId === userId;
    
    case 'study':
      // Check if user has any assigned tasks in study
      const study = await Study.findByPk(resourceId, {
        include: [{
          model: Task,
          where: { assignedToId: userId },
          required: false,
        }],
      });
      return study?.tasks?.length > 0;
    
    case 'project':
      // Check if user has any assigned tasks in project's studies
      const project = await Project.findByPk(resourceId, {
        include: [{
          model: Study,
          include: [{
            model: Task,
            where: { assignedToId: userId },
            required: false,
          }],
        }],
      });
      return project?.studies?.some(study => 
        study.tasks?.length > 0
      ) ?? false;
    
    default:
      return false;
  }
}
```

### 2.3 RBAC Middleware

```typescript
// src/lib/rbac/guards.ts

interface RBACOptions {
  resource: string;
  action: string;
  requireOwnership?: boolean;  // Check resource assignment
}

/**
 * RBAC Guard Middleware
 * Usage: await requirePermission(req, { resource: 'task', action: 'complete' })
 */
async function requirePermission(
  req: NextRequest,
  options: RBACOptions
): Promise<void> {
  // Extract user from request (set by auth middleware)
  const user = req.user;  // Attached by auth middleware
  
  if (!user) {
    throw new AuthenticationError('User not authenticated');
  }

  // Check role-based permission
  if (!hasPermission(user.role, options.resource, options.action)) {
    throw new PermissionError(
      `User role '${user.role}' cannot ${options.action} ${options.resource}`
    );
  }

  // If ownership/assignment check required
  if (options.requireOwnership) {
    const resourceId = extractResourceId(req);  // From URL params
    const canAccess = await canAccessResource(
      user.id,
      user.role,
      options.resource as 'project' | 'study' | 'task',
      resourceId
    );
    
    if (!canAccess) {
      throw new PermissionError(
        `User does not have access to ${options.resource} ${resourceId}`
      );
    }
  }
}
```

### 2.4 API Route RBAC Enforcement

```typescript
// Example: app/api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete/route.ts

POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete

Pseudocode:
1. Auth middleware verifies token → attaches user to request
2. RBAC guard checks permission:
   await requirePermission(req, {
     resource: 'task',
     action: 'complete',
     requireOwnership: false,  // Manager can complete any task
   })
3. If Researcher attempts → PermissionError (403 Forbidden)
4. If Manager → Continue to handler
5. Service layer enforces business rule:
   - Only Manager can mark task complete
   - Update task.status = 'completed'
   - Set task.completedById = user.id
   - Set task.completedAt = new Date()
```

---

## 3. API Route Middleware Strategy

### 3.1 Middleware Stack

```
Request
  │
  ▼
┌─────────────────────────┐
│ Next.js Middleware      │
│ (app/middleware.ts)      │
│ - Route matching         │
│ - CORS headers           │
│ - Request logging        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Auth Middleware         │
│ (verifyToken)           │
│ - Extract token         │
│ - Verify signature      │
│ - Check expiration      │
│ - Attach user to req    │
└───────────┬─────────────┘
            │
            ├─► Public Route? → Skip RBAC
            │
            └─► Protected Route? → Continue
                    │
                    ▼
┌─────────────────────────┐
│ RBAC Middleware         │
│ (requirePermission)      │
│ - Check role permission │
│ - Check resource access  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Route Handler           │
│ (Business Logic)         │
└─────────────────────────┘
```

### 3.2 Next.js Middleware (Edge)

```typescript
// app/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes (no auth required)
  const publicRoutes = ['/login', '/api/auth/login'];
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // API routes: Auth handled in route handler
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Protected pages: Check for access token
  const accessToken = request.cookies.get('accessToken')?.value ||
                      request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!accessToken && pathname.startsWith('/dashboard')) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 3.3 API Route Auth Middleware

```typescript
// src/lib/auth/middleware.ts

interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: number;
    email: string;
    role: UserRole;
  };
}

/**
 * Authentication Middleware for API Routes
 * Verifies JWT token and attaches user to request
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthenticatedRequest> {
  // Extract token from Authorization header or cookie
  const authHeader = req.headers.get('Authorization');
  const accessToken = authHeader?.replace('Bearer ', '') ||
                     req.cookies.get('accessToken')?.value;

  if (!accessToken) {
    // Try refresh token
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (refreshToken) {
      // Attempt token refresh (see Token Refresh Strategy)
      const newAccessToken = await attemptTokenRefresh(refreshToken);
      if (newAccessToken) {
        // Attach new token and continue
        return attachUserToRequest(req, newAccessToken);
      }
    }
    throw new AuthenticationError('No valid authentication token');
  }

  // Verify access token
  try {
    const payload = jwt.verify(accessToken, JWT_SECRET) as AccessTokenPayload;
    
    // Verify token type
    if (payload.type !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }

    // Verify user still exists and is active
    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User account is inactive');
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return req as AuthenticatedRequest;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Token expired, try refresh
      const refreshToken = req.cookies.get('refreshToken')?.value;
      if (refreshToken) {
        const newAccessToken = await attemptTokenRefresh(refreshToken);
        if (newAccessToken) {
          return attachUserToRequest(req, newAccessToken);
        }
      }
    }
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Helper: Attach user to request after token verification
 */
async function attachUserToRequest(
  req: NextRequest,
  token: string
): Promise<AuthenticatedRequest> {
  const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  const user = await User.findByPk(payload.userId);
  
  if (!user || !user.isActive) {
    throw new AuthenticationError('User account is inactive');
  }

  (req as AuthenticatedRequest).user = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return req as AuthenticatedRequest;
}
```

### 3.4 Route Handler Wrapper

```typescript
// src/lib/api/routeWrapper.ts

type RouteHandler = (
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<Response>;

interface RouteOptions {
  requireAuth?: boolean;  // Default: true
  requirePermission?: {
    resource: string;
    action: string;
    requireOwnership?: boolean;
  };
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
      if (options.requireAuth !== false) {
        await authenticateRequest(req);
      }

      // RBAC Check
      if (options.requirePermission) {
        await requirePermission(
          req as AuthenticatedRequest,
          options.requirePermission
        );
      }

      // Execute handler
      return await handler(req as AuthenticatedRequest, context);
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

      // Log server errors
      console.error('API Route Error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  };
}

// Usage Example:
// app/api/projects/route.ts
export const GET = createRouteHandler(
  async (req) => {
    // Handler logic with req.user available
    const projects = await projectService.getProjects(req.user.id, req.user.role);
    return NextResponse.json(projects);
  },
  {
    requireAuth: true,
    requirePermission: {
      resource: 'project',
      action: 'read',
      requireOwnership: req.user.role === 'Researcher',
    },
  }
);
```

---

## 4. Redux Auth State Flow

### 4.1 Auth Slice Structure

```typescript
// src/store/slices/authSlice.ts

interface AuthState {
  // User data
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: 'Manager' | 'Researcher';
  } | null;

  // Token management
  accessToken: string | null;
  tokenExpiry: number | null;  // Unix timestamp

  // Auth status
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Token refresh state
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
```

### 4.2 Auth Actions & Reducers

```typescript
// Auth Slice Actions

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Login actions
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{
      accessToken: string;
      user: AuthState['user'];
      tokenExpiry: number;
    }>) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.tokenExpiry = action.payload.tokenExpiry;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      
      // Persist to localStorage (backup)
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
    },

    // Logout actions
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.tokenExpiry = null;
      state.isAuthenticated = false;
      state.error = null;
      
      // Clear localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    },

    // Token refresh actions
    refreshTokenStart: (state) => {
      state.isRefreshing = true;
    },
    refreshTokenSuccess: (state, action: PayloadAction<{
      accessToken: string;
      tokenExpiry: number;
    }>) => {
      state.accessToken = action.payload.accessToken;
      state.tokenExpiry = action.payload.tokenExpiry;
      state.isRefreshing = false;
      
      localStorage.setItem('accessToken', action.payload.accessToken);
    },
    refreshTokenFailure: (state) => {
      state.isRefreshing = false;
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.tokenExpiry = null;
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    },

    // Initialize from localStorage (on app load)
    initializeAuth: (state) => {
      const storedToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const payload = jwt.decode(storedToken) as AccessTokenPayload;
          
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
});
```

### 4.3 Auth Thunks (Async Actions)

```typescript
// Auth Thunks

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
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

      const data = await response.json();
      
      // Decode token to get expiry
      const payload = jwt.decode(data.accessToken) as AccessTokenPayload;
      const tokenExpiry = payload.exp * 1000;  // Convert to milliseconds

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
      // Call logout endpoint to invalidate refresh token
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',  // Include cookies
      });
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      // Clear Redux state
      dispatch(authSlice.actions.logout());
      // Redirect to login
      window.location.href = '/login';
    }
  }
);

export const refreshTokenThunk = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',  // Include refresh token cookie
      });

      if (!response.ok) {
        return rejectWithValue('Token refresh failed');
      }

      const data = await response.json();
      const payload = jwt.decode(data.accessToken) as AccessTokenPayload;
      const tokenExpiry = payload.exp * 1000;

      return {
        accessToken: data.accessToken,
        tokenExpiry,
      };
    } catch (error) {
      return rejectWithValue('Token refresh failed');
    }
  }
);
```

### 4.4 Auth State Flow Diagram

```
App Initialization
  │
  ▼
┌─────────────────────┐
│ Redux Store Init    │
│ dispatch(initializeAuth)
└──────┬──────────────┘
       │
       ├─► Check localStorage
       │   ├─► Token exists & valid?
       │   │   ├─► YES → Set auth state
       │   │   │         isAuthenticated = true
       │   │   │
       │   │   └─► NO → Clear storage
       │   │             isAuthenticated = false
       │   │
       │   └─► No token → isAuthenticated = false
       │
       ▼
┌─────────────────────┐
│ User Login          │
│ dispatch(loginThunk)│
└──────┬──────────────┘
       │
       ├─► isLoading = true
       │
       ├─► API Call: POST /api/auth/login
       │
       ├─► Success?
       │   ├─► YES → loginSuccess action
       │   │         - Set accessToken
       │   │         - Set user data
       │   │         - Set tokenExpiry
       │   │         - isAuthenticated = true
       │   │         - Save to localStorage
       │   │
       │   └─► NO → loginFailure action
       │             - Set error message
       │             - isAuthenticated = false
       │
       ▼
┌─────────────────────┐
│ Authenticated State │
│ - Access API routes │
│ - Render dashboard  │
└──────┬──────────────┘
       │
       ├─► Token Expiry Check (see Token Refresh)
       │
       └─► User Logout
           dispatch(logoutThunk)
           - Clear Redux state
           - Clear localStorage
           - Redirect to /login
```

### 4.5 API Client Integration

```typescript
// src/lib/api/client.ts

/**
 * API Client with automatic token injection
 */
class ApiClient {
  private getAccessToken(): string | null {
    const state = store.getState();
    return state.auth.accessToken;
  }

  async request(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = this.getAccessToken();
    
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',  // Include cookies (refresh token)
    });

    // Handle token expiry
    if (response.status === 401) {
      // Attempt token refresh
      const refreshed = await store.dispatch(refreshTokenThunk());
      
      if (refreshed.type === 'auth/refreshToken/fulfilled') {
        // Retry original request with new token
        const newToken = this.getAccessToken();
        if (newToken) {
          headers.set('Authorization', `Bearer ${newToken}`);
          return fetch(url, { ...options, headers, credentials: 'include' });
        }
      }
      
      // Refresh failed, logout user
      store.dispatch(logoutThunk());
      throw new Error('Session expired. Please login again.');
    }

    return response;
  }
}

export const apiClient = new ApiClient();
```

---

## 5. Token Refresh Strategy

### 5.1 Refresh Flow

```
Access Token Expired (401 Unauthorized)
  │
  ▼
┌─────────────────────┐
│ API Client          │
│ Detects 401         │
└──────┬──────────────┘
       │
       │ dispatch(refreshTokenThunk())
       │
       ▼
┌─────────────────────┐
│ Redux:              │
│ isRefreshing = true │
└──────┬──────────────┘
       │
       │ POST /api/auth/refresh
       │ Cookie: refreshToken
       │
       ▼
┌─────────────────────┐
│ API Route Handler   │
│ /api/auth/refresh   │
└──────┬──────────────┘
       │
       │ 1. Extract refreshToken from cookie
       │ 2. Verify refreshToken signature
       │ 3. Check token expiration
       │ 4. Verify tokenVersion matches user.tokenVersion
       │ 5. Check user.isActive === true
       │
       ├─► Valid?
       │   ├─► YES → Generate new accessToken
       │   │         Return { accessToken }
       │   │
       │   └─► NO → 401 Unauthorized
       │             (Client will logout)
       │
       ▼
┌─────────────────────┐
│ Redux:              │
│ refreshTokenSuccess │
│ - Update accessToken│
│ - Update tokenExpiry│
│ - isRefreshing = false
└──────┬──────────────┘
       │
       │ Retry original request
       │ with new accessToken
       │
       ▼
┌─────────────────────┐
│ Request Succeeds    │
└─────────────────────┘
```

### 5.2 Refresh Endpoint

```typescript
// app/api/auth/refresh/route.ts

POST /api/auth/refresh
Request: Cookie: refreshToken=<token>
Response: { accessToken: string }

Pseudocode:
1. Extract refreshToken from httpOnly cookie
   - If missing → 401 Unauthorized
2. Verify refreshToken signature
   - jwt.verify(refreshToken, JWT_SECRET)
   - If invalid → 401 Unauthorized
3. Check token expiration
   - If expired → 401 Unauthorized
4. Verify token type === 'refresh'
   - If not → 401 Unauthorized
5. Load user from database
   - User.findByPk(payload.userId)
   - If not found → 401 Unauthorized
6. Verify tokenVersion matches
   - If payload.tokenVersion !== user.tokenVersion
     → 401 Unauthorized (token revoked)
7. Check user.isActive === true
   - If false → 403 Forbidden
8. Generate new accessToken
   - jwt.sign({ userId, email, role, type: 'access' }, SECRET, { expiresIn: '15m' })
9. Return new accessToken
   - Status: 200 OK
   - Body: { accessToken }
   - Note: Refresh token remains in cookie (not reissued)
```

### 5.3 Proactive Token Refresh

```typescript
// src/lib/auth/tokenRefresh.ts

/**
 * Proactive token refresh before expiry
 * Runs in background, refreshes token when < 5 minutes remaining
 */
export function setupTokenRefresh(store: AppStore) {
  const CHECK_INTERVAL = 60000;  // Check every minute
  
  setInterval(() => {
    const state = store.getState();
    const { accessToken, tokenExpiry, isRefreshing } = state.auth;
    
    if (!accessToken || !tokenExpiry || isRefreshing) {
      return;  // No token or already refreshing
    }
    
    const timeUntilExpiry = tokenExpiry - Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    // Refresh if less than 5 minutes remaining
    if (timeUntilExpiry < FIVE_MINUTES && timeUntilExpiry > 0) {
      store.dispatch(refreshTokenThunk());
    }
  }, CHECK_INTERVAL);
}

// Initialize in app root component or _app.tsx
// setupTokenRefresh(store);
```

### 5.4 Token Invalidation Scenarios

```typescript
// Scenarios that invalidate refresh tokens:

1. Password Change
   - Increment user.tokenVersion
   - All existing refresh tokens become invalid
   - User must login again

2. Account Deactivation
   - Set user.isActive = false
   - Refresh endpoint rejects token
   - User cannot refresh

3. Manual Token Revocation
   - Increment user.tokenVersion
   - Force logout all devices

4. Security Breach
   - Increment user.tokenVersion
   - Notify user to change password
```

---

## 6. Security Considerations

### 6.1 Token Security

```typescript
// Best Practices:

1. Access Token
   - Short expiry (15 minutes)
   - Stored in memory (Redux) + localStorage backup
   - Sent in Authorization header
   - NOT in cookies (XSS risk)

2. Refresh Token
   - Long expiry (7 days)
   - Stored ONLY in httpOnly cookie
   - NOT accessible via JavaScript
   - Automatically sent with requests
   - Protected from XSS

3. Token Payload
   - Minimal data (userId, email, role)
   - NO sensitive data (passwords, etc.)
   - Include token type to prevent confusion

4. Token Signing
   - Use strong secret (32+ characters)
   - Store secret in environment variable
   - Use HS256 algorithm (symmetric)
   - For production: Consider RS256 (asymmetric)
```

### 6.2 Password Security

```typescript
// Password Hashing (bcrypt)

const SALT_ROUNDS = 12;  // Higher = more secure, slower

// Hash password on user creation/update
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password on login
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Password Requirements:
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one number
// - At least one special character
```

### 6.3 Rate Limiting

```typescript
// Rate limiting for auth endpoints

// Login endpoint: 5 attempts per 15 minutes per IP
// Refresh endpoint: 10 requests per minute per IP

// Implementation (using express-rate-limit or similar)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  message: 'Too many login attempts. Please try again later.',
});

// Apply to /api/auth/login
```

### 6.4 CORS Configuration

```typescript
// Next.js API CORS

// Allow credentials (cookies) from trusted origins only
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
];

export function corsHeaders(origin: string | null) {
  const headers = new Headers();
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return headers;
}
```

### 6.5 Environment Variables

```bash
# .env.local (DO NOT COMMIT)

# JWT Configuration
JWT_SECRET=<strong-random-secret-32-chars-minimum>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (existing)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nberic_task_tracker
DB_USER=root
DB_PASSWORD=<password>
```

### 6.6 Security Headers

```typescript
// Next.js security headers (next.config.js)

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## 7. Error Handling

### 7.1 Authentication Errors

```typescript
// Custom Error Classes

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

// Error Response Format
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}

// Example Responses:
// 401 Unauthorized: { error: 'Unauthorized', message: 'Invalid or expired token' }
// 403 Forbidden: { error: 'Forbidden', message: 'Insufficient permissions' }
// 400 Bad Request: { error: 'Bad Request', message: 'Invalid credentials' }
```

### 7.2 Error Handling Flow

```typescript
// API Route Error Handling

try {
  // Auth check
  await authenticateRequest(req);
  
  // RBAC check
  await requirePermission(req, options);
  
  // Business logic
  const result = await service.method();
  return NextResponse.json(result);
  
} catch (error) {
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
  
  // Log server errors
  console.error('API Error:', error);
  return NextResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  );
}
```

---

## 8. Implementation Checklist

### 8.1 Backend Implementation

- [ ] Install dependencies: `jsonwebtoken`, `bcrypt`, `cookie`
- [ ] Create JWT utility functions (`src/lib/auth/jwt.ts`)
- [ ] Create password hashing utilities (`src/lib/auth/password.ts`)
- [ ] Implement auth middleware (`src/lib/auth/middleware.ts`)
- [ ] Implement RBAC guards (`src/lib/rbac/guards.ts`)
- [ ] Create route wrapper (`src/lib/api/routeWrapper.ts`)
- [ ] Implement login endpoint (`app/api/auth/login/route.ts`)
- [ ] Implement refresh endpoint (`app/api/auth/refresh/route.ts`)
- [ ] Implement logout endpoint (`app/api/auth/logout/route.ts`)
- [ ] Add tokenVersion field to User model (migration)
- [ ] Update User model with tokenVersion
- [ ] Add Next.js middleware (`app/middleware.ts`)
- [ ] Configure security headers (`next.config.js`)

### 8.2 Frontend Implementation

- [ ] Create auth slice (`src/store/slices/authSlice.ts`)
- [ ] Create auth thunks (login, logout, refresh)
- [ ] Create API client with token injection (`src/lib/api/client.ts`)
- [ ] Implement token refresh interceptor
- [ ] Setup proactive token refresh
- [ ] Create useAuth hook (`src/hooks/useAuth.ts`)
- [ ] Create usePermissions hook (`src/hooks/usePermissions.ts`)
- [ ] Implement login page (UI - separate task)
- [ ] Implement protected route wrapper
- [ ] Add token initialization on app load

### 8.3 Security Hardening

- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Configure rate limiting for auth endpoints
- [ ] Add CORS configuration
- [ ] Configure security headers
- [ ] Add password validation rules
- [ ] Implement password change endpoint (increment tokenVersion)
- [ ] Add account deactivation endpoint
- [ ] Setup error logging/monitoring
- [ ] Add request logging for security events

---

**Document Version**: 1.0  
**Last Updated**: Initial creation  
**Maintained By**: Authentication & Security Engineer

