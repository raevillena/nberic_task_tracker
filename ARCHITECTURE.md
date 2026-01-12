# System Architecture Document
## NBERIC Task Tracker

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   React UI   │  │ Redux Store  │  │ Socket Client│         │
│  │  Components  │  │   (State)    │  │  (Realtime)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
└────────────────────────────┼────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Next.js App   │
                    │     Router      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│  API Routes    │  │  Socket.IO      │  │  Middleware    │
│  (REST)        │  │  Server         │  │  (Auth/RBAC)   │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Service Layer  │
                    │  (Business      │
                    │   Logic)        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Sequelize ORM  │
                    │   (Models)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    MariaDB      │
                    │   (Database)    │
                    └─────────────────┘
```

### 1.2 Component Layers

- **Presentation Layer**: React components, pages, UI state
- **State Management Layer**: Redux Toolkit (global state, API cache)
- **Communication Layer**: HTTP (API routes), WebSocket (Socket.IO)
- **Application Layer**: Next.js API routes, middleware, business logic
- **Data Access Layer**: Sequelize ORM, models, migrations
- **Persistence Layer**: MariaDB database

---

## 2. Folder Structure

```
nberic_task_tracker/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Protected route group
│   │   ├── projects/
│   │   │   ├── [id]/
│   │   │   │   ├── studies/
│   │   │   │   │   └── [studyId]/
│   │   │   │   │       └── tasks/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── layout.tsx            # Protected layout with RBAC
│   │   └── page.tsx              # Dashboard home
│   ├── api/                      # API Routes
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── logout/
│   │   ├── projects/
│   │   │   ├── route.ts          # GET, POST /api/projects
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET, PUT, DELETE /api/projects/[id]
│   │   │       ├── studies/
│   │   │       │   ├── route.ts  # GET, POST /api/projects/[id]/studies
│   │   │       │   └── [studyId]/
│   │   │       │       ├── route.ts
│   │   │       │       └── tasks/
│   │   │       │           ├── route.ts
│   │   │       │           └── [taskId]/
│   │   │       │               ├── route.ts
│   │   │       │               └── complete/
│   │   │       └── progress/
│   │   ├── socket/               # Socket.IO endpoint
│   │   └── middleware.ts         # API middleware (auth, RBAC)
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing/redirect
│
├── src/
│   ├── components/               # React components
│   │   ├── common/              # Shared UI components
│   │   │   ├── button.tsx
│   │   │   ├── modal.tsx
│   │   │   └── loading.tsx
│   │   ├── layout/              # Layout components
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── navigation.tsx
│   │   ├── projects/            # Project-specific components
│   │   │   ├── projectCard.tsx
│   │   │   ├── projectForm.tsx
│   │   │   └── projectList.tsx
│   │   ├── studies/             # Study-specific components
│   │   │   ├── studyCard.tsx
│   │   │   ├── studyForm.tsx
│   │   │   └── studyList.tsx
│   │   ├── tasks/               # Task-specific components
│   │   │   ├── taskCard.tsx
│   │   │   ├── taskForm.tsx
│   │   │   ├── taskList.tsx
│   │   │   └── taskProgress.tsx
│   │   └── progress/            # Progress visualization
│   │       ├── progressBar.tsx
│   │       ├── progressChart.tsx
│   │       └── aggregateProgress.tsx
│   │
│   ├── lib/                      # Utilities and configurations
│   │   ├── db/                   # Database configuration
│   │   │   ├── connection.ts     # Sequelize connection
│   │   │   └── models/           # Sequelize models
│   │   │       ├── index.ts      # Model exports
│   │   │       ├── user.ts
│   │   │       ├── project.ts
│   │   │       ├── study.ts
│   │   │       └── task.ts
│   │   ├── socket/               # Socket.IO configuration
│   │   │   ├── server.ts         # Socket server setup
│   │   │   ├── handlers/         # Socket event handlers
│   │   │   │   ├── taskHandlers.ts
│   │   │   │   └── progressHandlers.ts
│   │   │   └── middleware.ts     # Socket auth middleware
│   │   ├── auth/                 # Authentication utilities
│   │   │   ├── session.ts        # Session management
│   │   │   ├── jwt.ts            # JWT utilities (if used)
│   │   │   └── password.ts       # Password hashing
│   │   ├── rbac/                 # RBAC utilities
│   │   │   ├── permissions.ts    # Permission definitions
│   │   │   ├── guards.ts         # Permission guards
│   │   │   └── decorators.ts     # RBAC decorators (if used)
│   │   └── utils/                # General utilities
│   │       ├── api.ts            # API client helpers
│   │       ├── validation.ts     # Validation schemas
│   │       └── errors.ts         # Error handling
│   │
│   ├── services/                 # Business logic layer
│   │   ├── projectService.ts    # Project business logic
│   │   ├── studyService.ts      # Study business logic
│   │   ├── taskService.ts       # Task business logic
│   │   ├── progressService.ts   # Progress calculation
│   │   └── userService.ts       # User management
│   │
│   ├── store/                    # Redux Toolkit store
│   │   ├── index.ts              # Store configuration
│   │   ├── hooks.ts              # Typed hooks (useAppDispatch, etc.)
│   │   ├── slices/               # Redux slices
│   │   │   ├── authSlice.ts      # Auth state
│   │   │   ├── projectSlice.ts   # Project state
│   │   │   ├── studySlice.ts     # Study state
│   │   │   ├── taskSlice.ts      # Task state
│   │   │   └── progressSlice.ts  # Progress state
│   │   └── api/                  # RTK Query API (if used)
│   │       └── baseApi.ts
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── entities.ts           # Domain entity types
│   │   ├── api.ts                # API request/response types
│   │   ├── rbac.ts               # RBAC types
│   │   └── socket.ts             # Socket event types
│   │
│   └── hooks/                    # Custom React hooks
│       ├── useAuth.ts
│       ├── useSocket.ts
│       ├── usePermissions.ts
│       └── useProgress.ts
│
├── public/                       # Static assets
│   └── images/
│
├── migrations/                   # Sequelize migrations
│   └── [timestamp]-[name].js
│
├── seeders/                      # Database seeders
│   └── [timestamp]-[name].js
│
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Example env file
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Data Flow

### 3.1 Request Flow (REST API)

```
User Action (UI)
    │
    ▼
React Component
    │
    ▼
Redux Action/Thunk
    │
    ▼
API Client (fetch/axios)
    │
    ▼
Next.js API Route (/app/api/...)
    │
    ├─► Middleware (auth, RBAC check)
    │       │
    │       ├─► Auth Middleware: Verify session/token
    │       │
    │       └─► RBAC Middleware: Check permissions
    │               │
    │               └─► Permission Guard: Allow/Deny
    │
    ▼
Service Layer (business logic)
    │
    ├─► Validation
    ├─► Business Rules
    └─► Progress Calculation (if needed)
    │
    ▼
Sequelize Model (ORM)
    │
    ├─► Query Building
    ├─► Relationship Loading
    └─► Transaction Management
    │
    ▼
MariaDB Database
    │
    ▼
Response (JSON)
    │
    ▼
Redux Store Update
    │
    ▼
UI Re-render
```

### 3.2 Real-time Flow (Socket.IO)

```
Client Socket Connection
    │
    ▼
Socket.IO Server (/app/api/socket)
    │
    ├─► Socket Middleware (auth)
    │       └─► Verify user session
    │
    ▼
Socket Event Handler
    │
    ├─► RBAC Check (per event)
    │       └─► Permission validation
    │
    ▼
Service Layer (business logic)
    │
    ▼
Database Operation (Sequelize)
    │
    ▼
Broadcast Event
    │
    ├─► Emit to Room (project/study specific)
    └─► Emit to User (personal updates)
    │
    ▼
Connected Clients (Redux update)
    │
    ▼
UI Re-render (real-time)
```

### 3.3 Progress Aggregation Flow

```
Task Completion Event
    │
    ├─► Task Service: Update task status
    │
    ▼
Progress Service: Calculate Study Progress
    │
    ├─► Fetch all tasks in study
    ├─► Count completed vs total
    └─► Calculate percentage
    │
    ▼
Progress Service: Calculate Project Progress
    │
    ├─► Fetch all studies in project
    ├─► Aggregate study progress (weighted or simple average)
    └─► Calculate project percentage
    │
    ▼
Database Update (Study & Project records)
    │
    ├─► Update study.progress
    └─► Update project.progress
    │
    ▼
Socket Broadcast
    │
    ├─► Emit 'progress:updated' to project room
    └─► Include: projectId, studyId, taskId, new progress values
    │
    ▼
Client Updates (Redux + UI)
```

---

## 4. RBAC Enforcement Points

### 4.1 Role Definitions

- **Manager**: Full CRUD on projects, studies, tasks. Can assign tasks and mark completion.
- **Researcher**: Read access to assigned projects/studies/tasks. Cannot complete tasks.

### 4.2 Permission Matrix

| Resource | Action | Manager | Researcher |
|----------|--------|---------|------------|
| Project  | Create | ✅      | ❌         |
| Project  | Read   | ✅      | ✅         |
| Project  | Update | ✅      | ❌         |
| Project  | Delete | ✅      | ❌         |
| Study    | Create | ✅      | ❌         |
| Study    | Read   | ✅      | ✅ (assigned) |
| Study    | Update | ✅      | ❌         |
| Study    | Delete | ✅      | ❌         |
| Task     | Create | ✅      | ❌         |
| Task     | Read   | ✅      | ✅ (assigned) |
| Task     | Update | ✅      | ✅ (assigned, limited) |
| Task     | Complete | ✅   | ❌         |
| Task     | Assign | ✅      | ❌         |
| Task     | Delete | ✅      | ❌         |

### 4.3 Enforcement Layers

#### Layer 1: Route Protection (Next.js Middleware)
```
Location: app/(dashboard)/layout.tsx, app/api/middleware.ts

Enforcement:
- Check if user is authenticated
- Redirect unauthenticated users to /login
- Attach user role to request context
```

#### Layer 2: API Route Guards
```
Location: app/api/**/route.ts

Enforcement:
- Verify authentication token/session
- Extract user role from session
- Check permission before executing handler
- Return 403 Forbidden if unauthorized
```

#### Layer 3: Service Layer Guards
```
Location: src/services/*.ts

Enforcement:
- Validate user permissions for specific actions
- Check resource ownership/assignment
- Enforce business rules (e.g., Researcher cannot complete tasks)
- Throw PermissionError if unauthorized
```

#### Layer 4: Component-Level Guards
```
Location: src/components/**/*.tsx

Enforcement:
- Conditionally render UI elements based on permissions
- Disable/hide actions user cannot perform
- Show appropriate messaging
```

#### Layer 5: Socket Event Guards
```
Location: src/lib/socket/handlers/*.ts

Enforcement:
- Verify user authentication on connection
- Check permissions per socket event
- Validate user can access resource (project/study/task)
- Emit error events if unauthorized
```

### 4.4 RBAC Implementation Points

#### API Routes
```
/api/projects
  - POST: Manager only
  - GET: Manager (all), Researcher (assigned only)

/api/projects/[id]
  - PUT: Manager only
  - DELETE: Manager only

/api/projects/[id]/studies
  - POST: Manager only
  - GET: Manager (all), Researcher (assigned only)

/api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete
  - POST: Manager only (explicit check)
```

#### Socket Events
```
socket.on('task:complete')
  - Handler checks: user.role === 'Manager'
  - Reject if Researcher attempts

socket.on('task:assign')
  - Handler checks: user.role === 'Manager'

socket.on('task:update')
  - Handler checks: user.role === 'Manager' OR (Researcher + assigned)
```

#### Service Methods
```
taskService.completeTask()
  - Guard: if (user.role !== 'Manager') throw PermissionError

taskService.assignTask()
  - Guard: if (user.role !== 'Manager') throw PermissionError

studyService.getStudies()
  - Filter: if (user.role === 'Researcher') return assigned only
```

---

## 5. Progress Aggregation Strategy

### 5.1 Hierarchy Model

```
Project (100%)
  │
  ├─► Study 1 (60%)
  │     ├─► Task 1 ✅ (100%)
  │     ├─► Task 2 ✅ (100%)
  │     ├─► Task 3 ⏳ (0%)
  │     └─► Task 4 ⏳ (0%)
  │
  ├─► Study 2 (33%)
  │     ├─► Task 5 ✅ (100%)
  │     └─► Task 6 ⏳ (0%)
  │
  └─► Study 3 (0%)
        └─► Task 7 ⏳ (0%)
```

### 5.2 Calculation Strategy

#### Task Level
```
Task Progress = (status === 'completed') ? 100 : 0
```

#### Study Level
```
Study Progress = (Completed Tasks / Total Tasks) × 100

Example:
  Study 1: 2 completed / 4 total = 50%
  Study 2: 1 completed / 2 total = 50%
```

#### Project Level
```
Option A: Simple Average (Default)
  Project Progress = Average of all Study Progress values
  
  Example:
    (50% + 50% + 0%) / 3 = 33.33%

Option B: Weighted Average (Future)
  Project Progress = Σ(Study Progress × Study Weight) / Total Weight
  (Requires weight field on Study model)
```

### 5.3 Update Triggers

#### Immediate Updates
- Task completion → Recalculate study → Recalculate project
- Task creation → Recalculate study → Recalculate project
- Task deletion → Recalculate study → Recalculate project

#### Batch Updates (Optional Optimization)
- Debounce rapid task updates (e.g., bulk operations)
- Queue progress calculations
- Process in background job (if needed)

### 5.4 Caching Strategy

#### Database Caching
```
Store calculated progress on:
  - study.progress (decimal, 0-100)
  - project.progress (decimal, 0-100)

Benefits:
  - Fast reads without recalculation
  - Historical progress tracking
```

#### In-Memory Caching (Optional)
```
Redux Store:
  - Cache progress values per project/study
  - Invalidate on task updates
  - Refresh via Socket.IO events
```

### 5.5 Progress Service Flow

```
ProgressService.calculateStudyProgress(studyId)
  1. Fetch all tasks for study
  2. Count completed tasks
  3. Calculate percentage
  4. Update study.progress in database
  5. Return progress value

ProgressService.calculateProjectProgress(projectId)
  1. Fetch all studies for project
  2. For each study:
     - Use study.progress (cached) OR recalculate
  3. Calculate average (or weighted average)
  4. Update project.progress in database
  5. Return progress value

ProgressService.updateProgressChain(taskId)
  1. Get task's study and project
  2. Calculate study progress
  3. Calculate project progress
  4. Emit Socket.IO events for real-time updates
  5. Return updated progress values
```

### 5.6 Real-time Progress Updates

```
Socket Events:
  - 'progress:task:updated' → { taskId, studyId, projectId, taskProgress }
  - 'progress:study:updated' → { studyId, projectId, studyProgress }
  - 'progress:project:updated' → { projectId, projectProgress }

Client Handling:
  - Listen to progress events
  - Update Redux store
  - Re-render progress indicators
  - Show notifications (optional)
```

---

## 6. Security Considerations

### 6.1 Authentication
- Session-based or JWT token authentication
- Secure password hashing (bcrypt)
- Session timeout/expiration

### 6.2 Authorization
- RBAC checks at multiple layers (defense in depth)
- Resource-level access control (Researcher sees only assigned items)
- Input validation and sanitization

### 6.3 Data Protection
- SQL injection prevention (Sequelize parameterized queries)
- XSS prevention (React's built-in escaping)
- CSRF protection (Next.js built-in)

### 6.4 Socket Security
- Authenticate socket connections
- Validate socket event payloads
- Rate limiting on socket events

---

## 7. Error Handling Strategy

### 7.1 Error Types
- **AuthenticationError**: User not authenticated
- **PermissionError**: User lacks required permission
- **ValidationError**: Invalid input data
- **NotFoundError**: Resource not found
- **DatabaseError**: Database operation failed

### 7.2 Error Flow
```
Service throws error
    │
    ▼
API route catches error
    │
    ├─► Log error (server-side)
    ├─► Map to HTTP status code
    └─► Return JSON error response
    │
    ▼
Client receives error
    │
    ├─► Redux error state
    └─► UI displays error message
```

---

## 8. Scalability Considerations

### 8.1 Database
- Indexes on foreign keys (projectId, studyId, taskId)
- Indexes on user assignments
- Connection pooling (Sequelize)

### 8.2 Real-time
- Socket.IO rooms for project/study scoping
- Limit broadcast scope to relevant users
- Consider Redis adapter for multi-server (future)

### 8.3 Caching
- Progress values cached in database
- Redux store for client-side caching
- Consider Redis for server-side caching (future)

---

## 9. Development Workflow

### 9.1 Environment Setup
- Development: Local MariaDB, hot reload
- Staging: Staging database, production-like config
- Production: Production database, optimized build

### 9.2 Database Migrations
- Sequelize migrations for schema changes
- Version-controlled migration files
- Rollback support

### 9.3 Testing Strategy (Future)
- Unit tests: Services, utilities
- Integration tests: API routes
- E2E tests: Critical user flows

---

## 10. Future Enhancements

### 10.1 Potential Additions
- Task dependencies
- Task priorities
- Time tracking
- Comments/notes on tasks
- File attachments
- Email notifications
- Activity logs/audit trail
- Advanced progress weighting
- Multi-tenancy support

### 10.2 Performance Optimizations
- Database query optimization
- Pagination for large lists
- Virtual scrolling for UI
- Background job processing
- CDN for static assets

---

**Document Version**: 1.0  
**Last Updated**: Initial creation  
**Maintained By**: System Architect

