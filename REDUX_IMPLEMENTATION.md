# Redux Store Implementation
## NBERIC Task Tracker - Redux Toolkit Architecture

---

## Overview

This document describes the Redux Toolkit store implementation for the NBERIC Task Tracker application. The store uses normalized state patterns, async thunks for API calls, and Socket.IO integration for real-time updates.

---

## Store Structure

### Root State Shape

```typescript
{
  auth: AuthState,
  project: ProjectState,      // Normalized
  study: StudyState,           // Normalized
  task: TaskState,             // Normalized
  progress: ProgressState,      // Cached progress values
  messages: MessagesState,      // Socket.IO messages
  analytics: AnalyticsState    // Analytics metrics
}
```

---

## Normalized State Strategy

### Why Normalization?

Normalized state prevents:
- Data duplication
- Inconsistent updates
- Performance issues with large arrays

### Implementation Pattern

All entity slices (project, study, task) use the same pattern:

```typescript
interface EntityState {
  entities: Record<number, Entity>;  // O(1) lookup by ID
  ids: number[];                     // Maintains order
  byParentId?: Record<number, number[]>; // Relationships
  currentEntityId: number | null;
  // ... loading/error states
}
```

### Benefits

1. **O(1) Lookups**: `state.project.entities[projectId]` instead of `state.projects.find(p => p.id === projectId)`
2. **Single Source of Truth**: Each entity stored once, referenced by ID
3. **Efficient Updates**: Update one entity without affecting others
4. **Relationship Mapping**: `byProjectId` and `byStudyId` for quick filtering

---

## Slice Implementations

### 1. authSlice

**Purpose**: Authentication and session management

**State**:
- User information
- Access token and expiry
- Authentication status
- Loading/error states

**Key Features**:
- Token refresh handling
- localStorage persistence
- Session initialization on app load

**Async Thunks**:
- `loginThunk`: User login
- `logoutThunk`: User logout
- `refreshTokenThunk`: Token refresh

---

### 2. projectSlice (Normalized)

**Purpose**: Project entity management

**State Structure**:
```typescript
{
  entities: Record<number, Project>,
  ids: number[],
  currentProjectId: number | null,
  isLoading: boolean,
  isCreating: boolean,
  isUpdating: boolean,
  isDeleting: boolean,
  error: string | null
}
```

**Async Thunks**:
- `fetchProjectsThunk`: Fetch all projects
- `fetchProjectByIdThunk`: Fetch single project
- `createProjectThunk`: Create new project
- `updateProjectThunk`: Update project
- `deleteProjectThunk`: Delete project

**Selectors**:
- `selectAllProjects`: Get all projects as array
- `selectProjectById`: Get project by ID
- `selectCurrentProject`: Get currently selected project

---

### 3. studySlice (Normalized)

**Purpose**: Study entity management with project relationship

**State Structure**:
```typescript
{
  entities: Record<number, Study>,
  ids: number[],
  byProjectId: Record<number, number[]>,  // Project -> Study IDs
  currentStudyId: number | null,
  // ... loading/error states
}
```

**Async Thunks**:
- `fetchStudiesByProjectThunk`: Fetch studies for a project
- `fetchStudyByIdThunk`: Fetch single study
- `createStudyThunk`: Create new study
- `updateStudyThunk`: Update study
- `deleteStudyThunk`: Delete study

**Selectors**:
- `selectAllStudies`: Get all studies
- `selectStudyById`: Get study by ID
- `selectStudiesByProjectId`: Get studies for a project
- `selectCurrentStudy`: Get currently selected study

---

### 4. taskSlice (Normalized + Socket Integration)

**Purpose**: Task entity management with study relationship and real-time updates

**State Structure**:
```typescript
{
  entities: Record<number, Task>,
  ids: number[],
  byStudyId: Record<number, number[]>,  // Study -> Task IDs
  currentTaskId: number | null,
  // ... loading/error states
}
```

**Async Thunks**:
- `fetchTasksByStudyThunk`: Fetch tasks for a study
- `fetchTaskByIdThunk`: Fetch single task
- `createTaskThunk`: Create new task
- `updateTaskThunk`: Update task
- `completeTaskThunk`: Complete task (Manager only)
- `assignTaskThunk`: Assign task to researcher

**Socket Actions**:
- `updateTaskFromSocket`: Update task from Socket.IO event

**Selectors**:
- `selectAllTasks`: Get all tasks
- `selectTaskById`: Get task by ID
- `selectTasksByStudyId`: Get tasks for a study
- `selectCurrentTask`: Get currently selected task

---

### 5. progressSlice (Socket Integration)

**Purpose**: Cache progress values for real-time updates

**State Structure**:
```typescript
{
  projectProgress: Record<number, number>,
  studyProgress: Record<number, number>,
  taskProgress: Record<number, number>,
  lastUpdated: {
    projects: Record<number, number>,
    studies: Record<number, number>,
    tasks: Record<number, number>
  }
}
```

**Actions**:
- `updateProjectProgress`: Update project progress
- `updateStudyProgress`: Update study progress
- `updateTaskProgress`: Update task progress
- `updateProgressFromSocket`: Handle socket progress events
- `updateProgressChain`: Batch update (task -> study -> project)
- `clearProgress`: Clear progress cache

**Selectors**:
- `selectProjectProgress`: Get project progress
- `selectStudyProgress`: Get study progress
- `selectTaskProgress`: Get task progress

---

### 6. messagesSlice (Socket Integration)

**Purpose**: Socket.IO message state management

**State Structure**:
```typescript
{
  rooms: Record<RoomKey, RoomState>,  // Room-based message storage
  activeRoom: { type: MessageRoomType | null, id: number | null },
  socketConnected: boolean,
  socketAuthenticated: boolean,
  socketError: string | null,
  socketUser: { userId: number | null, userRole: string | null }
}
```

**Features**:
- Room-based message storage (`project:1`, `study:5`)
- Typing indicators
- Message history pagination
- Real-time message updates via Socket.IO

---

### 7. analyticsSlice

**Purpose**: Analytics metrics and cached data

**State Structure**:
```typescript
{
  // Researcher productivity
  researcherProductivity: ResearcherProductivity[],
  researcherProductivityLoading: boolean,
  researcherProductivityError: string | null,
  
  // Project metrics
  projectProgress: ProjectProgressMetrics[],
  projectVelocity: ProjectVelocity[],
  projectHealthScores: ProjectHealthScore[],
  
  // Study metrics
  studyProgressDistribution: StudyProgressDistribution[],
  studyCompletionForecast: StudyCompletionForecast[],
  
  // Task metrics
  taskPriorityDistribution: TaskPriorityDistribution | null,
  highPriorityBacklog: HighPriorityBacklog[],
  
  // Compliance metrics
  complianceFlagRate: ComplianceFlagRate | null,
  complianceFlagTrends: ComplianceFlagTrend[],
  complianceFlagResolutionTime: ComplianceFlagResolutionTime[],
  
  // ... loading/error states for each metric
}
```

**Async Thunks**:
- `fetchResearcherProductivityThunk`
- `fetchProjectProgressThunk`
- `fetchProjectVelocityThunk`
- `fetchProjectHealthScoresThunk`
- `fetchStudyProgressDistributionThunk`
- `fetchStudyCompletionForecastThunk`
- `fetchTaskPriorityDistributionThunk`
- `fetchHighPriorityBacklogThunk`
- `fetchComplianceFlagRateThunk`
- `fetchComplianceFlagTrendsThunk`
- `fetchComplianceFlagResolutionTimeThunk`

---

## Socket.IO → Redux Integration

### Event Flow

```
Socket.IO Event → Socket Client Handler → Redux Action → Store Update → UI Re-render
```

### Socket Event Handlers

Located in `src/lib/socket/client.ts`:

#### Task Events
- `task:updated` → `updateTaskFromSocket`
- `task:completed` → `updateTaskFromSocket`
- `task:assigned` → `updateTaskFromSocket`

#### Progress Events
- `progress:task:updated` → `updateProgressFromSocket`
- `progress:study:updated` → `updateProgressFromSocket`
- `progress:project:updated` → `updateProgressFromSocket`

#### Message Events
- `message:new` → `addMessage`
- `message:edited` → `updateMessage`
- `message:deleted` → `deleteMessage`
- `message:history` → `setMessages`
- `typing:started` → `addTypingUser`
- `typing:stopped` → `removeTypingUser`

### Initialization

Socket client is initialized with Redux dispatch:

```typescript
import { initializeSocketClient } from '@/lib/socket/client';
import { useAppDispatch } from '@/store/hooks';

const dispatch = useAppDispatch();
const socket = initializeSocketClient(accessToken, dispatch);
```

---

## Async Thunk Patterns

### Standard Pattern

```typescript
export const fetchEntityThunk = createAsyncThunk(
  'entity/fetchEntity',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/entities/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch entity');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);
```

### Error Handling

All thunks use `rejectWithValue` for consistent error handling:

```typescript
extraReducers: (builder) => {
  builder
    .addCase(fetchEntityThunk.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchEntityThunk.fulfilled, (state, action) => {
      // Update normalized state
      const entity = action.payload;
      state.entities[entity.id] = entity;
      if (!state.ids.includes(entity.id)) {
        state.ids.push(entity.id);
      }
      state.isLoading = false;
    })
    .addCase(fetchEntityThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
}
```

---

## Selectors

### Purpose

Selectors provide a consistent API for accessing normalized state and computed values.

### Usage

```typescript
import { useAppSelector } from '@/store/hooks';
import { selectAllProjects, selectProjectById } from '@/store/slices/projectSlice';

// In component
const projects = useAppSelector(selectAllProjects);
const project = useAppSelector((state) => selectProjectById(state, projectId));
```

### Benefits

1. **Encapsulation**: State structure changes don't break components
2. **Memoization**: Can be memoized with `reselect` if needed
3. **Type Safety**: Full TypeScript support
4. **Reusability**: Share selectors across components

---

## Best Practices

### 1. Always Use Normalized State for Entities

✅ **Good**:
```typescript
state.entities[projectId] = project;
```

❌ **Bad**:
```typescript
state.projects.push(project);
```

### 2. Update Relationships When Adding Entities

```typescript
// Add entity
state.entities[entity.id] = entity;
if (!state.ids.includes(entity.id)) {
  state.ids.push(entity.id);
}

// Update relationship mapping
if (!state.byParentId[entity.parentId]) {
  state.byParentId[entity.parentId] = [];
}
if (!state.byParentId[entity.parentId].includes(entity.id)) {
  state.byParentId[entity.parentId].push(entity.id);
}
```

### 3. Handle Socket Events in Reducers

Socket events should update normalized state directly:

```typescript
updateTaskFromSocket: (state, action: PayloadAction<Task>) => {
  const task = action.payload;
  if (state.entities[task.id]) {
    state.entities[task.id] = task;  // Update existing
  } else {
    // Add new entity if it doesn't exist
    state.entities[task.id] = task;
    state.ids.push(task.id);
  }
}
```

### 4. Use Loading States Per Operation

Different operations have different loading states:

```typescript
isLoading: boolean;      // Fetch operations
isCreating: boolean;      // Create operations
isUpdating: boolean;      // Update operations
isDeleting: boolean;      // Delete operations
```

### 5. Clear Errors on New Requests

Always clear errors when starting a new operation:

```typescript
.addCase(fetchEntityThunk.pending, (state) => {
  state.isLoading = true;
  state.error = null;  // Clear previous errors
})
```

---

## Type Safety

### RootState Type

```typescript
export type RootState = ReturnType<typeof store.getState>;
```

### Typed Hooks

```typescript
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

### Usage

```typescript
const dispatch = useAppDispatch();
const projects = useAppSelector((state) => state.project.entities);
```

---

## Performance Considerations

### 1. Normalized State Benefits

- O(1) lookups instead of O(n) array searches
- No duplicate data
- Efficient updates

### 2. Selector Memoization

For expensive computations, use `reselect`:

```typescript
import { createSelector } from '@reduxjs/toolkit';

const selectProjects = (state: RootState) => state.project.entities;
const selectProjectIds = (state: RootState) => state.project.ids;

export const selectAllProjects = createSelector(
  [selectProjects, selectProjectIds],
  (entities, ids) => ids.map(id => entities[id])
);
```

### 3. Batch Updates

Use `updateProgressChain` for batch progress updates:

```typescript
dispatch(updateProgressChain({
  taskId: 1,
  taskProgress: 100,
  studyId: 5,
  studyProgress: 75,
  projectId: 10,
  projectProgress: 50
}));
```

---

## Testing Considerations

### Mock Store

```typescript
import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '@/store/slices/projectSlice';

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      project: projectReducer,
    },
    preloadedState: initialState,
  });
};
```

### Testing Async Thunks

```typescript
import { fetchProjectsThunk } from '@/store/slices/projectSlice';

test('fetchProjectsThunk', async () => {
  const store = createMockStore();
  const result = await store.dispatch(fetchProjectsThunk());
  expect(result.type).toBe('project/fetchProjects/fulfilled');
});
```

---

## Migration Notes

### From Non-Normalized to Normalized

If migrating existing code:

1. Update selectors to use normalized state
2. Update components to use new selectors
3. Update socket handlers to use normalized actions
4. Test all CRUD operations

### Breaking Changes

- `state.projects` → `state.project.entities` (use selector)
- `state.currentProject` → `state.project.currentProjectId` (use selector)
- Direct array access → Use selectors

---

## Summary

The Redux store implementation provides:

✅ **Normalized State**: Efficient entity management  
✅ **Socket Integration**: Real-time updates  
✅ **Type Safety**: Full TypeScript support  
✅ **Async Thunks**: Consistent API patterns  
✅ **Selectors**: Clean state access  
✅ **Error Handling**: Comprehensive error management  
✅ **Performance**: Optimized for large datasets  

All slices follow consistent patterns, making the codebase maintainable and scalable.

---

**Last Updated**: Implementation complete  
**Maintained By**: Redux Engineer

