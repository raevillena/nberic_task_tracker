# REST API Design Document
## NBERIC Task Tracker - Backend API

---

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Service Layer Pattern](#service-layer-pattern)
4. [Transaction Examples](#transaction-examples)
5. [Error Handling](#error-handling)
6. [RBAC Enforcement](#rbac-enforcement)
7. [Progress Recalculation](#progress-recalculation)
8. [Non-Compliance Logic](#non-compliance-logic)

---

## Overview

This document describes the REST API design for the NBERIC Task Tracker backend. The API follows RESTful principles and uses a service-layer pattern to separate business logic from route handlers.

### Tech Stack
- **Framework**: Next.js App Router (API Routes)
- **Language**: TypeScript
- **ORM**: Sequelize v7
- **Database**: MariaDB
- **Authentication**: JWT/Session-based (to be implemented)

### Architecture Pattern

```
API Route Handler (app/api/...)
    ↓
Service Layer (src/services/...)
    ↓
Sequelize Models (src/lib/db/models/...)
    ↓
MariaDB Database
```

---

## API Endpoints

### Projects

#### GET /api/projects
Get all projects.

**Authorization**:
- Managers: See all projects
- Researchers: See only projects with assigned tasks

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Project Alpha",
      "description": "Research project",
      "progress": 45.5,
      "createdById": 1,
      "createdAt": "2024-01-01T00:00:00Z",
      "createdBy": {
        "id": 1,
        "email": "manager@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ]
}
```

#### POST /api/projects
Create a new project.

**Authorization**: Managers only

**Request Body**:
```json
{
  "name": "Project Alpha",
  "description": "Research project description"
}
```

**Response**: `201 Created`
```json
{
  "data": {
    "id": 1,
    "name": "Project Alpha",
    "description": "Research project description",
    "progress": 0,
    "createdById": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /api/projects/[id]
Get a single project by ID.

**Authorization**:
- Managers: Can access any project
- Researchers: Can only access projects with assigned tasks

#### PUT /api/projects/[id]
Update a project.

**Authorization**: Managers only

**Request Body**:
```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

#### DELETE /api/projects/[id]
Delete a project.

**Authorization**: Managers only

**Note**: Cascades to delete all studies and tasks.

---

### Studies

#### GET /api/projects/[id]/studies
Get all studies for a project.

**Authorization**:
- Managers: See all studies
- Researchers: See only studies with assigned tasks

#### POST /api/projects/[id]/studies
Create a new study.

**Authorization**: Managers only

**Request Body**:
```json
{
  "name": "Study 1",
  "description": "Study description"
}
```

#### GET /api/projects/[id]/studies/[studyId]
Get a single study by ID.

#### PUT /api/projects/[id]/studies/[studyId]
Update a study.

**Authorization**: Managers only

#### DELETE /api/projects/[id]/studies/[studyId]
Delete a study.

**Authorization**: Managers only

**Note**: Cascades to delete all tasks.

---

### Tasks

#### GET /api/projects/[id]/studies/[studyId]/tasks
Get all tasks for a study.

**Authorization**:
- Managers: See all tasks
- Researchers: See only assigned tasks

#### POST /api/projects/[id]/studies/[studyId]/tasks
Create a new task.

**Authorization**: Managers only

**Request Body**:
```json
{
  "name": "Task 1",
  "description": "Task description",
  "priority": "high",
  "assignedToId": 2,
  "dueDate": "2024-12-31"
}
```

**Note**: Automatically recalculates study and project progress.

#### GET /api/projects/[id]/studies/[studyId]/tasks/[taskId]
Get a single task by ID.

**Authorization**:
- Managers: Can access any task
- Researchers: Can only access assigned tasks

#### PUT /api/projects/[id]/studies/[studyId]/tasks/[taskId]
Update a task.

**Authorization**:
- Managers: Can update all fields
- Researchers: Can only update name, description, and status (not to completed)

**Request Body**:
```json
{
  "name": "Updated Task Name",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "medium",
  "assignedToId": 2,
  "dueDate": "2024-12-31"
}
```

#### DELETE /api/projects/[id]/studies/[studyId]/tasks/[taskId]
Delete a task.

**Authorization**: Managers only

**Note**: Automatically recalculates study and project progress.

---

### Task Assignment

#### POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/assign
Assign a task to a researcher.

**Authorization**: Managers only

**Request Body**:
```json
{
  "assignedToId": 2
}
```

**Note**: If task status is `pending`, it automatically changes to `in_progress`.

---

### Task Completion

#### POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete
Complete a task.

**Authorization**: Managers only

**Response**:
```json
{
  "data": {
    "id": 1,
    "name": "Task 1",
    "status": "completed",
    "completedAt": "2024-01-15T10:30:00Z",
    "completedById": 1,
    "studyId": 1,
    ...
  }
}
```

**Note**: 
- Uses transaction to ensure task completion and progress recalculation are atomic
- Automatically recalculates study and project progress
- Sets `completedAt` and `completedById` fields

---

### Compliance Flags

#### GET /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance
Get all compliance flags for a task.

**Authorization**:
- Managers: Can see all flags
- Researchers: Can only see flags for assigned tasks

#### POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance
Create a compliance flag.

**Authorization**:
- Managers: Can flag any task
- Researchers: Can only flag assigned tasks

**Request Body**:
```json
{
  "flagType": "data_quality",
  "severity": "high",
  "description": "Data quality issue detected"
}
```

**Response**: `201 Created`

---

## Service Layer Pattern

The service layer encapsulates all business logic and data access operations. This pattern provides:

1. **Separation of Concerns**: Route handlers focus on HTTP concerns, services handle business logic
2. **Reusability**: Services can be used by API routes, Socket.IO handlers, or background jobs
3. **Testability**: Services can be unit tested independently
4. **Transaction Management**: Services can accept transactions for atomic operations

### Service Structure

```typescript
// Example: taskService.ts
export class TaskService {
  async createTask(
    studyId: number,
    data: CreateTaskData,
    user: User,
    transaction?: Transaction
  ): Promise<Task> {
    // Business logic here
    // Validation
    // Database operations
    // Progress recalculation
  }
}

// Export singleton
export const taskService = new TaskService();
```

### Service Methods

#### ProjectService
- `getAllProjects(user, transaction?)`: Get all projects (filtered by role)
- `getProjectById(projectId, user, transaction?)`: Get single project
- `createProject(data, user, transaction?)`: Create project
- `updateProject(projectId, data, user, transaction?)`: Update project
- `deleteProject(projectId, user, transaction?)`: Delete project

#### StudyService
- `getStudiesByProject(projectId, user, transaction?)`: Get studies for project
- `getStudyById(studyId, user, transaction?)`: Get single study
- `createStudy(projectId, data, user, transaction?)`: Create study
- `updateStudy(studyId, data, user, transaction?)`: Update study
- `deleteStudy(studyId, user, transaction?)`: Delete study

#### TaskService
- `getTasksByStudy(studyId, user, transaction?)`: Get tasks for study
- `getTaskById(taskId, user, transaction?)`: Get single task
- `createTask(studyId, data, user, transaction?)`: Create task
- `updateTask(taskId, data, user, transaction?)`: Update task
- `assignTask(taskId, assignedToId, user, transaction?)`: Assign task
- `completeTask(taskId, user, transaction?)`: Complete task
- `deleteTask(taskId, user, transaction?)`: Delete task

#### ProgressService
- `calculateStudyProgress(studyId, transaction?)`: Calculate study progress
- `calculateProjectProgress(projectId, transaction?)`: Calculate project progress
- `updateProgressChain(studyId, transaction?)`: Update progress chain (task → study → project)
- `recalculateProjectProgress(projectId, transaction?)`: Recalculate all progress for project

#### ComplianceService
- `createComplianceFlag(taskId, data, user, transaction?)`: Create compliance flag
- `getComplianceFlagsByTask(taskId, user, transaction?)`: Get flags for task
- `getComplianceFlagById(flagId, user, transaction?)`: Get single flag
- `resolveComplianceFlag(flagId, data, user, transaction?)`: Resolve flag
- `dismissComplianceFlag(flagId, data, user, transaction?)`: Dismiss flag
- `getOpenComplianceFlagsByTask(taskId, user, transaction?)`: Get open flags for task

---

## Transaction Examples

### Example 1: Task Completion with Progress Recalculation

```typescript
// app/api/projects/[id]/studies/[studyId]/tasks/[taskId]/complete/route.ts
export async function POST(request: NextRequest, { params }) {
  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    const user = await getAuthenticatedUser(request);
    const taskId = parseInt(params.taskId, 10);

    // Complete task and recalculate progress within transaction
    const task = await taskService.completeTask(taskId, user, transaction);

    // Commit transaction
    await transaction.commit();

    return NextResponse.json({ data: task });
  } catch (error) {
    // Rollback on error
    await transaction.rollback();
    return createErrorResponse(error, getErrorStatusCode(error));
  }
}
```

```typescript
// src/services/taskService.ts
async completeTask(
  taskId: number,
  user: User,
  transaction?: Transaction
): Promise<Task> {
  // Get task
  const task = await this.getTaskById(taskId, user, transaction);

  // Update task
  task.status = TaskStatus.COMPLETED;
  task.completedAt = new Date();
  task.completedById = user.id;
  await task.save({ transaction });

  // Recalculate progress (uses same transaction)
  await progressService.updateProgressChain(task.studyId, transaction);

  return task;
}
```

```typescript
// src/services/progressService.ts
async updateProgressChain(
  studyId: number,
  existingTransaction?: Transaction
): Promise<ProgressResult> {
  // Use existing transaction or create new one
  const shouldCommit = !existingTransaction;
  const transaction = existingTransaction || await sequelize.transaction();

  try {
    // Get study
    const study = await Study.findByPk(studyId, { transaction });

    // Step 1: Calculate study progress
    const studyProgress = await this.calculateStudyProgress(
      studyId,
      transaction
    );

    // Step 2: Calculate project progress
    const projectProgress = await this.calculateProjectProgress(
      study.projectId,
      transaction
    );

    // Commit if we created the transaction
    if (shouldCommit) {
      await transaction.commit();
    }

    return { studyProgress, projectProgress, projectId: study.projectId };
  } catch (error) {
    // Rollback if we created the transaction
    if (shouldCommit) {
      await transaction.rollback();
    }
    throw error;
  }
}
```

### Example 2: Creating Task with Progress Recalculation

```typescript
// src/services/taskService.ts
async createTask(
  studyId: number,
  data: CreateTaskData,
  user: User,
  transaction?: Transaction
): Promise<Task> {
  // Validation and task creation
  const task = await Task.create({
    studyId,
    name: data.name.trim(),
    // ... other fields
  }, { transaction });

  // Recalculate progress (uses same transaction if provided)
  await progressService.updateProgressChain(studyId, transaction);

  return task;
}
```

### Example 3: Bulk Operations with Transaction

```typescript
// Example: Bulk task creation
async createMultipleTasks(
  studyId: number,
  tasks: CreateTaskData[],
  user: User
): Promise<Task[]> {
  const transaction = await sequelize.transaction();

  try {
    const createdTasks: Task[] = [];

    for (const taskData of tasks) {
      const task = await taskService.createTask(
        studyId,
        taskData,
        user,
        transaction
      );
      createdTasks.push(task);
    }

    // Single progress recalculation at the end
    await progressService.updateProgressChain(studyId, transaction);

    await transaction.commit();
    return createdTasks;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

---

## Error Handling

### Error Types

1. **AuthenticationError** (401): User not authenticated
2. **PermissionError** (403): User lacks required permission
3. **ValidationError** (400): Invalid input data
4. **NotFoundError** (404): Resource not found
5. **DatabaseError** (500): Database operation failed

### Error Response Format

```json
{
  "error": "PermissionError",
  "message": "Only Managers can complete tasks"
}
```

### Error Handling in Routes

```typescript
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();
    const result = await service.method(body, user);
    return NextResponse.json({ data: result });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
```

---

## RBAC Enforcement

### Permission Matrix

| Resource | Action | Manager | Researcher |
|----------|--------|---------|------------|
| Project | Create | ✅ | ❌ |
| Project | Read | ✅ (all) | ✅ (assigned) |
| Project | Update | ✅ | ❌ |
| Project | Delete | ✅ | ❌ |
| Study | Create | ✅ | ❌ |
| Study | Read | ✅ (all) | ✅ (assigned) |
| Study | Update | ✅ | ❌ |
| Study | Delete | ✅ | ❌ |
| Task | Create | ✅ | ❌ |
| Task | Read | ✅ (all) | ✅ (assigned) |
| Task | Update | ✅ | ✅ (limited) |
| Task | Complete | ✅ | ❌ |
| Task | Assign | ✅ | ❌ |
| Task | Delete | ✅ | ❌ |

### Enforcement Points

1. **API Route Level**: Check authentication
2. **Service Layer**: Check permissions and business rules
3. **Data Access**: Filter results based on role

### Example: Service Layer RBAC

```typescript
async completeTask(taskId: number, user: User): Promise<Task> {
  // RBAC check
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only Managers can complete tasks');
  }

  // Business logic
  const task = await this.getTaskById(taskId, user);
  // ... rest of logic
}
```

---

## Progress Recalculation

### Calculation Strategy

1. **Task Level**: Binary (completed = 100%, not completed = 0%)
2. **Study Level**: `(Completed Tasks / Total Tasks) × 100`
3. **Project Level**: `Average of all Study Progress values`

### Update Triggers

Progress is automatically recalculated when:
- Task is created
- Task is completed
- Task is deleted
- Task status changes (if affecting completion)

### Transaction Safety

All progress calculations use transactions to ensure:
- Atomicity: All progress updates succeed or fail together
- Consistency: Progress values are always accurate
- Isolation: Concurrent updates don't cause race conditions

### Example Flow

```
Task Completion
    ↓
Task Service: Update task status (transaction)
    ↓
Progress Service: Calculate study progress (same transaction)
    ↓
Progress Service: Calculate project progress (same transaction)
    ↓
Commit transaction
```

---

## Non-Compliance Logic

### Compliance Flag Model

Compliance flags track non-compliance issues on tasks:

- **flagType**: Category of issue (e.g., "data_quality", "protocol_violation")
- **severity**: Level of severity (low, medium, high, critical)
- **status**: Current state (open, resolved, dismissed)
- **description**: Detailed description of the issue

### Compliance Flag Operations

1. **Create Flag**: Managers or Researchers (for assigned tasks)
2. **View Flags**: Managers (all), Researchers (assigned tasks only)
3. **Resolve Flag**: Managers only
4. **Dismiss Flag**: Managers only

### Example: Creating Compliance Flag

```typescript
// POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/compliance
const flag = await complianceService.createComplianceFlag(
  taskId,
  {
    flagType: 'data_quality',
    severity: 'high',
    description: 'Missing required data points'
  },
  user
);
```

### Example: Resolving Compliance Flag

```typescript
// Resolve flag (Managers only)
const resolvedFlag = await complianceService.resolveComplianceFlag(
  flagId,
  { notes: 'Issue has been addressed' },
  user
);
```

---

## Best Practices

### 1. Always Use Transactions for Multi-Step Operations

```typescript
const transaction = await sequelize.transaction();
try {
  // Multiple operations
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

### 2. Pass Transactions Through Service Methods

```typescript
// Service method accepts optional transaction
async method(data: Data, user: User, transaction?: Transaction) {
  // Use transaction if provided
  return await Model.create(data, { transaction });
}
```

### 3. Validate Input at Service Layer

```typescript
if (!data.name || data.name.trim().length === 0) {
  throw new ValidationError('Name is required');
}
```

### 4. Check Permissions Early

```typescript
if (user.role !== UserRole.MANAGER) {
  throw new PermissionError('Only Managers can perform this action');
}
```

### 5. Use Consistent Error Handling

```typescript
try {
  // Operation
} catch (error) {
  return createErrorResponse(error, getErrorStatusCode(error));
}
```

---

## Future Enhancements

1. **Pagination**: Add pagination support for list endpoints
2. **Filtering**: Add query parameters for filtering (status, priority, etc.)
3. **Sorting**: Add sorting options
4. **Search**: Add full-text search capabilities
5. **Bulk Operations**: Add bulk create/update/delete endpoints
6. **Audit Logging**: Log all operations for compliance
7. **Rate Limiting**: Add rate limiting to prevent abuse
8. **Caching**: Add caching for frequently accessed data

---

**Document Version**: 1.0  
**Last Updated**: Initial creation  
**Maintained By**: Backend API Engineer

