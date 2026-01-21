# Roles and Permissions Reference

This document lists all roles and permission checks used in the application for integration with the external authentication API.

## Role Definitions

The application uses **2 roles**:

```typescript
enum UserRole {
  MANAGER = 'Manager',      // String value: "Manager"
  RESEARCHER = 'Researcher' // String value: "Researcher"
}
```

## Permission Matrix

### Projects
| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| `create` | Manager | Only managers can create projects |
| `read` | Manager, Researcher | Researchers can only see assigned projects |
| `update` | Manager | Only managers can update projects |
| `delete` | Manager | Only managers can delete projects |

### Studies
| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| `create` | Manager | Only managers can create studies |
| `read` | Manager, Researcher | Researchers can only see studies with assigned tasks |
| `update` | Manager | Only managers can update studies |
| `delete` | Manager | Only managers can delete studies |

### Tasks
| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| `create` | Manager | Only managers can create tasks |
| `read` | Manager, Researcher | Researchers can only see assigned tasks |
| `update` | Manager, Researcher | Researchers can update limited fields (not status to completed) |
| `complete` | Manager | **CRITICAL: Only Manager can complete tasks** |
| `assign` | Manager | Only managers can assign tasks |
| `delete` | Manager | Only managers can delete tasks |

## Role Checks in API Routes

### Direct Role Checks
1. **`/api/projects` (GET)** - Filters projects for Researchers (assigned only)
2. **`/api/projects/[id]/studies` (GET)** - Filters studies for Researchers (assigned only)
3. **`/api/navigation/unread-counts` (GET)** - Only Researchers get unread counts
4. **`/api/task-requests` (GET)** - Researchers only see their own requests
5. **`/api/task-requests/count` (GET)** - Only Managers see pending request counts

### Permission-Based Checks (via `requirePermission`)
- **`/api/studies/[studyId]/tasks` (POST)** - Requires `task.create` permission
- **`/api/studies/[studyId]/tasks` (GET)** - Requires `task.read` permission

## Role Checks in Services

### TaskService
- `getAllTasks()` - Filters by role (Researcher: assigned only)
- `getTaskById()` - Checks access for Researchers
- `createTask()` - Requires Manager role
- `updateTask()` - Researchers cannot set status to COMPLETED
- `completeTask()` - **Requires Manager role** (CRITICAL)
- `assignTask()` - Requires Manager role
- `deleteTask()` - Requires Manager role
- `requestTaskCompletion()` - Requires Researcher role
- `requestTaskReassignment()` - Requires Researcher role
- `approveTaskRequest()` - Requires Manager role
- `rejectTaskRequest()` - Requires Manager role

### ProjectService
- `getAllProjects()` - Filters by role (Researcher: assigned only)
- `getProjectById()` - Checks access for Researchers
- `createProject()` - Requires Manager role
- `updateProject()` - Requires Manager role
- `deleteProject()` - Requires Manager role

### ComplianceService
- `getComplianceFlags()` - Researchers can only see flags for assigned tasks

## Role Checks in Components

### UI Conditional Rendering
- **Create buttons** - Only shown for Managers
- **Edit/Delete buttons** - Only shown for Managers
- **Complete task button** - Only shown for Managers
- **Task assignment UI** - Only shown for Managers
- **Request completion/reassignment** - Only shown for Researchers
- **Trash/restore functionality** - Only shown for Managers

### Navigation
- **Sidebar** - Different navigation items based on role:
  - Managers: Projects, Studies, Tasks, Requests, Trash
  - Researchers: Projects, Studies, Tasks (filtered views)

## Special Role-Based Behaviors

### Manager
- Can access **all** projects, studies, and tasks
- Can create, update, delete all resources
- Can assign tasks to researchers
- Can complete tasks
- Can approve/reject task requests
- Can view trash and restore deleted items

### Researcher
- Can only access **assigned** projects, studies, and tasks
- Cannot create projects or studies
- Cannot delete projects, studies, or tasks
- Can update assigned tasks (but **cannot** set status to COMPLETED)
- Can request task completion (requires manager approval)
- Can request task reassignment (requires manager approval)
- Cannot see trash/restore functionality

## Critical Security Rules

1. **Task Completion**: Only Managers can mark tasks as completed
   - Researchers can request completion but cannot do it themselves
   - This is enforced in both frontend and backend

2. **Task Assignment**: Only Managers can assign tasks
   - Researchers cannot assign tasks to themselves or others

3. **Resource Access**: Researchers can only access assigned resources
   - Automatic filtering in queries
   - Access checks in service layer
   - UI hides non-assigned resources

## Role String Values for API Server

When implementing in the external API server, use these **exact string values**:

- `"Manager"` (capital M, lowercase rest)
- `"Researcher"` (capital R, lowercase rest)

These are the enum values used throughout the application and stored in the database.

## Example Role Checks

```typescript
// Check if user is Manager
if (user.role === UserRole.MANAGER) { ... }
if (user.role === 'Manager') { ... }

// Check if user is Researcher
if (user.role === UserRole.RESEARCHER) { ... }
if (user.role === 'Researcher') { ... }

// Check permission
if (hasPermission(user.role, 'task', 'complete')) {
  // Only returns true for Manager
}
```

## Resources and Actions Summary

**Resources**: `project`, `study`, `task`

**Actions**: `create`, `read`, `update`, `delete`, `complete`, `assign`

**Roles**: `Manager`, `Researcher`
