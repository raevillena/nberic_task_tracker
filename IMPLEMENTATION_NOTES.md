# Implementation Notes
## Backend API Implementation

---

## What Has Been Implemented

### ✅ Service Layer
- **projectService.ts**: Complete CRUD operations for projects with RBAC
- **studyService.ts**: Complete CRUD operations for studies with RBAC
- **taskService.ts**: Complete CRUD operations for tasks with RBAC, assignment, and completion
- **progressService.ts**: Progress calculation with transaction support
- **complianceService.ts**: Compliance flag management (non-compliance logic)

### ✅ API Routes
- **Projects**: GET, POST, PUT, DELETE
- **Studies**: GET, POST, PUT, DELETE (nested under projects)
- **Tasks**: GET, POST, PUT, DELETE (nested under studies)
- **Task Assignment**: POST /assign
- **Task Completion**: POST /complete (with transaction)
- **Compliance Flags**: GET, POST (nested under tasks)

### ✅ Documentation
- **API_DESIGN.md**: Comprehensive API design documentation
- Transaction examples
- RBAC enforcement patterns
- Progress recalculation strategy

---

## What Needs to Be Done

### 1. Database Models

The Sequelize models need to be created based on `DATABASE_SCHEMA.md`. Currently, only `user.ts` exists. You need to create:

- `src/lib/db/models/project.ts`
- `src/lib/db/models/study.ts`
- `src/lib/db/models/task.ts`
- `src/lib/db/models/complianceFlag.ts`
- `src/lib/db/models/index.ts` (to export all models and set up associations)

**Note**: The service files use dynamic imports to avoid circular dependencies. Once the models are created, the imports will work correctly.

### 2. Authentication Implementation

The `app/api/middleware.ts` file has a placeholder for authentication:

```typescript
export async function getAuthenticatedUser(request: NextRequest): Promise<UserContext> {
  // TODO: Implement actual authentication
  throw new AuthenticationError('Authentication not implemented');
}
```

You need to implement:
- JWT token verification OR session-based authentication
- Extract user from token/session
- Return UserContext with id, email, and role

### 3. Model Associations

After creating the models, set up associations in `src/lib/db/models/index.ts`:

```typescript
// Example associations
Project.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });
Project.hasMany(Study, { foreignKey: 'projectId', as: 'studies' });
Study.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Study.hasMany(Task, { foreignKey: 'studyId', as: 'tasks' });
Task.belongsTo(Study, { foreignKey: 'studyId', as: 'study' });
Task.belongsTo(User, { foreignKey: 'assignedToId', as: 'assignedTo' });
// ... etc (see DATABASE_SCHEMA.md for full list)
```

### 4. Type Exports

Ensure all enums and types are exported from the model files:

```typescript
// src/lib/db/models/task.ts
export enum TaskStatus { ... }
export enum TaskPriority { ... }

// src/lib/db/models/complianceFlag.ts
export enum ComplianceFlagStatus { ... }
export enum ComplianceFlagSeverity { ... }
```

### 5. Testing

After implementation, test:
- All CRUD operations
- RBAC enforcement (try accessing as Researcher vs Manager)
- Transaction rollback on errors
- Progress recalculation accuracy
- Compliance flag operations

---

## Key Design Decisions

### 1. Service Layer Pattern
- All business logic is in services
- Routes are thin wrappers around services
- Services can be reused by Socket.IO handlers or background jobs

### 2. Transaction Management
- Progress recalculation uses transactions for atomicity
- Services accept optional `transaction` parameter
- Transaction is created at route level for multi-step operations

### 3. RBAC Enforcement
- Three layers: Route → Service → Data Access
- Service layer throws `PermissionError` for unauthorized actions
- Data access filters results based on role

### 4. Progress Calculation
- Cached in database (study.progress, project.progress)
- Recalculated on task changes
- Uses transactions to ensure consistency

### 5. Non-Compliance Logic
- Compliance flags are separate from tasks
- Managers can resolve/dismiss flags
- Researchers can create flags for assigned tasks

---

## File Structure

```
src/
├── services/
│   ├── projectService.ts      ✅
│   ├── studyService.ts        ✅
│   ├── taskService.ts         ✅
│   ├── progressService.ts     ✅
│   └── complianceService.ts   ✅
│
app/
└── api/
    ├── middleware.ts          ✅ (needs auth implementation)
    ├── projects/
    │   ├── route.ts           ✅
    │   └── [id]/
    │       ├── route.ts       ✅
    │       └── studies/
    │           ├── route.ts   ✅
    │           └── [studyId]/
    │               ├── route.ts ✅
    │               └── tasks/
    │                   ├── route.ts ✅
    │                   └── [taskId]/
    │                       ├── route.ts ✅
    │                       ├── assign/
    │                       │   └── route.ts ✅
    │                       ├── complete/
    │                       │   └── route.ts ✅
    │                       └── compliance/
    │                           └── route.ts ✅
```

---

## Next Steps

1. **Create Database Models**: Implement all Sequelize models from `DATABASE_SCHEMA.md`
2. **Set Up Associations**: Configure model relationships
3. **Implement Authentication**: Complete the `getAuthenticatedUser` function
4. **Test Endpoints**: Use Postman or similar to test all endpoints
5. **Add Validation**: Consider adding Zod schemas for request validation
6. **Add Logging**: Add request/response logging for debugging
7. **Add Rate Limiting**: Protect endpoints from abuse

---

## Example Usage

### Create Project (Manager)
```bash
POST /api/projects
Authorization: Bearer <manager_token>
{
  "name": "Research Project",
  "description": "Description here"
}
```

### Create Study (Manager)
```bash
POST /api/projects/1/studies
Authorization: Bearer <manager_token>
{
  "name": "Study 1",
  "description": "Study description"
}
```

### Create Task (Manager)
```bash
POST /api/projects/1/studies/1/tasks
Authorization: Bearer <manager_token>
{
  "name": "Task 1",
  "priority": "high",
  "assignedToId": 2
}
```

### Complete Task (Manager)
```bash
POST /api/projects/1/studies/1/tasks/1/complete
Authorization: Bearer <manager_token>
```

### Create Compliance Flag (Manager or Researcher)
```bash
POST /api/projects/1/studies/1/tasks/1/compliance
Authorization: Bearer <token>
{
  "flagType": "data_quality",
  "severity": "high",
  "description": "Issue description"
}
```

---

**Document Version**: 1.0  
**Last Updated**: Initial creation

