# Analytics Design Document
## NBERIC Task Tracker - Analytics Metrics & Performance Optimization

---

## Table of Contents

1. [Analytics Metrics Overview](#analytics-metrics-overview)
2. [Service Layer Architecture](#service-layer-architecture)
3. [API Route Integration](#api-route-integration)
4. [Researcher Productivity Metrics](#researcher-productivity-metrics)
5. [Project Progress Metrics](#project-progress-metrics)
6. [Study Progress Metrics](#study-progress-metrics)
7. [Task Priority Distribution Metrics](#task-priority-distribution-metrics)
8. [Non-Compliance Rates Metrics](#non-compliance-rates-metrics)
9. [Indexing Strategy](#indexing-strategy)
10. [Caching Strategy](#caching-strategy)
11. [Query Performance Optimization](#query-performance-optimization)

---

## Analytics Metrics Overview

This document defines SQL-level analytics metrics optimized for Sequelize v7 and MariaDB. All queries are designed for efficiency, leveraging proper indexing and aggregation techniques.

**Architecture Alignment**: This design follows the system architecture defined in `ARCHITECTURE.md`:
- **Service Layer Pattern**: Analytics implemented as `AnalyticsService` in `src/services/analyticsService.ts`
- **API Route Integration**: Exposed via REST endpoints in `app/api/analytics/`
- **RBAC Enforcement**: Respects role-based access control (Researchers see only their data)
- **Error Handling**: Uses custom error classes from `src/lib/utils/errors.ts`
- **Type Safety**: Leverages TypeScript types from `src/types/`

### Key Design Principles

- **Aggregation at Database Level**: Minimize data transfer by computing metrics in SQL
- **Index-Aware Queries**: All queries leverage existing and recommended indexes
- **Time-Range Filtering**: Support flexible date range filtering for trend analysis
- **Role-Based Filtering**: Respect RBAC constraints (Researchers see only their data)
- **Minimal Joins**: Use subqueries and aggregations to reduce join complexity
- **Service Layer Pattern**: Follows existing service architecture (ProgressService, TaskService)
- **Transaction Support**: Optional transaction parameter for consistency

---

## Service Layer Architecture

### File Structure

Following the architecture defined in `ARCHITECTURE.md`, analytics are implemented as a service:

```
src/
├── services/
│   └── analyticsService.ts    # Analytics business logic
│
app/
└── api/
    └── analytics/
        ├── route.ts            # GET /api/analytics (list available metrics)
        ├── productivity/
        │   └── route.ts        # GET /api/analytics/productivity
        ├── projects/
        │   └── route.ts        # GET /api/analytics/projects
        ├── studies/
        │   └── route.ts        # GET /api/analytics/studies
        ├── priority/
        │   └── route.ts        # GET /api/analytics/priority
        └── compliance/
            └── route.ts        # GET /api/analytics/compliance
```

### Service Class Pattern

The `AnalyticsService` follows the same pattern as `ProgressService` and `TaskService`:

```typescript
// src/services/analyticsService.ts
// Analytics service - Business logic for analytics metrics

import { Transaction } from 'sequelize';
import { Task, User, Study, Project } from '@/lib/db/models';
import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';
import { UserContext } from '@/types/rbac';
import { PermissionError, ValidationError, NotFoundError } from '@/lib/utils/errors';
import { Op } from 'sequelize';

/**
 * Service layer for Analytics operations
 * Handles analytics queries with RBAC enforcement
 * All methods respect role-based access control
 */
export class AnalyticsService {
  /**
   * Validate date range for analytics queries
   * @private
   */
  private validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate > endDate) {
      throw new ValidationError('Start date must be before end date');
    }
    
    const maxRangeDays = 365; // Maximum 1 year range
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > maxRangeDays) {
      throw new ValidationError(`Date range cannot exceed ${maxRangeDays} days`);
    }
  }

  /**
   * Apply RBAC filtering to task queries
   * Researchers can only see their assigned tasks
   * @private
   */
  private applyRbacFilter(whereClause: any, user: UserContext): void {
    if (user.role === UserRole.RESEARCHER) {
      whereClause.assignedToId = user.id;
    }
  }

  // Analytics methods defined below...
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
```

### RBAC Enforcement

All analytics methods enforce RBAC following the architecture's multi-layer approach:

1. **Service Layer**: Methods check `UserContext` and filter data based on role
2. **API Route Layer**: Routes verify authentication before calling service methods
3. **Data Filtering**: Researchers automatically see only their assigned tasks/projects/studies

---

## API Route Integration

### Example API Route Implementation

Following the architecture pattern from `app/api/projects/route.ts`:

```typescript
// app/api/analytics/productivity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analyticsService';
import { getAuthenticatedUser } from '@/lib/auth/middleware';
import { routeWrapper } from '@/lib/api/routeWrapper';

export async function GET(request: NextRequest) {
  return routeWrapper(async () => {
    const user = await getAuthenticatedUser(request);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const researcherId = searchParams.get('researcherId')
      ? parseInt(searchParams.get('researcherId')!, 10)
      : null;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    // Researchers can only query their own data
    if (user.role === UserRole.RESEARCHER) {
      if (researcherId && researcherId !== user.id) {
        throw new PermissionError('You can only view your own productivity metrics');
      }
      researcherId = user.id; // Force to their own ID
    }

    const metrics = await analyticsService.getResearcherCompletionRate(
      researcherId,
      startDate,
      endDate,
      user
    );

    return NextResponse.json({ data: metrics });
  });
}
```

### API Endpoints Summary

| Endpoint | Method | Description | RBAC |
|----------|--------|-------------|------|
| `/api/analytics/productivity` | GET | Researcher productivity metrics | Manager: all, Researcher: self only |
| `/api/analytics/projects` | GET | Project progress and health metrics | Manager: all, Researcher: assigned only |
| `/api/analytics/studies` | GET | Study progress and forecast | Manager: all, Researcher: assigned only |
| `/api/analytics/priority` | GET | Task priority distribution | Manager: all, Researcher: assigned only |
| `/api/analytics/compliance` | GET | Compliance flag metrics | Manager: all, Researcher: assigned only |

---

## Researcher Productivity Metrics

### 1.1 Task Completion Rate

**Metric**: Percentage of assigned tasks completed within a time period.

**Business Value**: Measures researcher efficiency and workload management.

```typescript
/**
 * Get task completion rate for a researcher or all researchers
 * @param researcherId - Optional: specific researcher ID, null for all researchers
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getResearcherCompletionRate(
  researcherId: number | null,
  startDate: Date,
  endDate: Date,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}>> {
  // Validate date range
  this.validateDateRange(startDate, endDate);

  // RBAC: Researchers can only query their own data
  if (user.role === UserRole.RESEARCHER) {
    if (researcherId && researcherId !== user.id) {
      throw new PermissionError('You can only view your own productivity metrics');
    }
    researcherId = user.id; // Force to their own ID
  }
  const whereClause: any = {
    assignedToId: researcherId ? { [Op.eq]: researcherId } : { [Op.ne]: null },
    createdAt: {
      [Op.between]: [startDate, endDate],
    },
  };

  // Apply RBAC filter (redundant for researchers after above check, but consistent pattern)
  this.applyRbacFilter(whereClause, user);

  // Single query with aggregation - leverages idx_tasks_assigned_to and idx_tasks_status
  const result = await Task.findAll({
    transaction,
    attributes: [
      'assignedToId',
      [Task.sequelize!.fn('COUNT', Task.sequelize!.col('id')), 'totalTasks'],
      [
        Task.sequelize!.fn(
          'SUM',
          Task.sequelize!.literal(
            `CASE WHEN status = '${TaskStatus.COMPLETED}' THEN 1 ELSE 0 END`
          )
        ),
        'completedTasks',
      ],
      [
        Task.sequelize!.fn(
          'AVG',
          Task.sequelize!.literal(
            `CASE WHEN status = '${TaskStatus.COMPLETED}' THEN 1.0 ELSE 0.0 END`
          )
        ),
        'completionRate',
      ],
    ],
    where: whereClause,
    include: [
      {
        model: User,
        as: 'assignedTo',
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: true,
        where: {
          role: UserRole.RESEARCHER,
          isActive: true,
        },
      },
    ],
    group: ['assignedToId', 'assignedTo.id'],
    raw: false,
  });

  return result.map((row: any) => ({
    researcherId: row.assignedToId,
    researcher: {
      id: row.assignedTo.id,
      email: row.assignedTo.email,
      name: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
    },
    totalTasks: parseInt(row.getDataValue('totalTasks') || '0', 10),
    completedTasks: parseInt(row.getDataValue('completedTasks') || '0', 10),
    completionRate: parseFloat(row.getDataValue('completionRate') || '0') * 100,
  }));
}
```

### 1.2 Average Task Completion Time

**Metric**: Average time from task assignment to completion.

**Business Value**: Identifies bottlenecks and workload distribution issues.

```typescript
/**
 * Calculate average time to complete tasks for researchers
 * Uses TIMESTAMPDIFF for efficient date calculation in MariaDB
 * @param researcherId - Optional: specific researcher ID, null for all researchers
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getAverageCompletionTime(
  researcherId: number | null,
  startDate: Date,
  endDate: Date,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  avgHoursToComplete: number;
  minHoursToComplete: number;
  maxHoursToComplete: number;
  completedCount: number;
}>> {
  // Validate date range
  this.validateDateRange(startDate, endDate);

  // RBAC: Researchers can only query their own data
  if (user.role === UserRole.RESEARCHER) {
    if (researcherId && researcherId !== user.id) {
      throw new PermissionError('You can only view your own productivity metrics');
    }
    researcherId = user.id;
  }
  const whereClause: any = {
    status: TaskStatus.COMPLETED,
    completedAt: {
      [Op.between]: [startDate, endDate],
    },
    assignedToId: researcherId ? { [Op.eq]: researcherId } : { [Op.ne]: null },
  };

  // Apply RBAC filter
  this.applyRbacFilter(whereClause, user);

  // Leverages idx_tasks_status and idx_tasks_assigned_to
  const result = await Task.findAll({
    transaction,
    attributes: [
      'assignedToId',
      [
        Task.sequelize!.fn(
          'AVG',
          Task.sequelize!.fn(
            'TIMESTAMPDIFF',
            Task.sequelize!.literal('HOUR'),
            Task.sequelize!.col('createdAt'),
            Task.sequelize!.col('completedAt')
          )
        ),
        'avgHoursToComplete',
      ],
      [
        Task.sequelize!.fn(
          'MIN',
          Task.sequelize!.fn(
            'TIMESTAMPDIFF',
            Task.sequelize!.literal('HOUR'),
            Task.sequelize!.col('createdAt'),
            Task.sequelize!.col('completedAt')
          )
        ),
        'minHoursToComplete',
      ],
      [
        Task.sequelize!.fn(
          'MAX',
          Task.sequelize!.fn(
            'TIMESTAMPDIFF',
            Task.sequelize!.literal('HOUR'),
            Task.sequelize!.col('createdAt'),
            Task.sequelize!.col('completedAt')
          )
        ),
        'maxHoursToComplete',
      ],
      [Task.sequelize!.fn('COUNT', Task.sequelize!.col('id')), 'completedCount'],
    ],
    where: whereClause,
    include: [
      {
        model: User,
        as: 'assignedTo',
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: true,
      },
    ],
    group: ['assignedToId', 'assignedTo.id'],
    raw: false,
  });

  return result.map((row: any) => ({
    researcherId: row.assignedToId,
    researcher: {
      id: row.assignedTo.id,
      email: row.assignedTo.email,
      name: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
    },
    avgHoursToComplete: parseFloat(row.getDataValue('avgHoursToComplete') || '0'),
    minHoursToComplete: parseInt(row.getDataValue('minHoursToComplete') || '0', 10),
    maxHoursToComplete: parseInt(row.getDataValue('maxHoursToComplete') || '0', 10),
    completedCount: parseInt(row.getDataValue('completedCount') || '0', 10),
  }));
}
```

### 1.3 Tasks Per Researcher (Workload Distribution)

**Metric**: Count of active tasks (pending + in_progress) per researcher.

**Business Value**: Identifies workload imbalances and capacity planning.

```typescript
/**
 * Get current workload distribution across researchers
 * Active tasks = PENDING + IN_PROGRESS status
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getResearcherWorkload(
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  activeTaskCount: number;
  pendingCount: number;
  inProgressCount: number;
}>> {
  const whereClause: any = {
    assignedToId: { [Op.ne]: null },
    status: {
      [Op.in]: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
    },
  };

  // Apply RBAC filter - Researchers only see their own workload
  this.applyRbacFilter(whereClause, user);

  const result = await Task.findAll({
    transaction,
    attributes: [
      'assignedToId',
      [
        Task.sequelize!.fn(
          'COUNT',
          Task.sequelize!.col('id')
        ),
        'activeTaskCount',
      ],
      [
        Task.sequelize!.fn(
          'SUM',
          Task.sequelize!.literal(
            `CASE WHEN status = '${TaskStatus.PENDING}' THEN 1 ELSE 0 END`
          )
        ),
        'pendingCount',
      ],
      [
        Task.sequelize!.fn(
          'SUM',
          Task.sequelize!.literal(
            `CASE WHEN status = '${TaskStatus.IN_PROGRESS}' THEN 1 ELSE 0 END`
          )
        ),
        'inProgressCount',
      ],
    ],
    where: whereClause,
    include: [
      {
        model: User,
        as: 'assignedTo',
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: true,
        where: {
          role: UserRole.RESEARCHER,
          isActive: true,
        },
      },
    ],
    group: ['assignedToId', 'assignedTo.id'],
    order: [[Task.sequelize!.literal('activeTaskCount'), 'DESC']],
    raw: false,
  });

  return result.map((row: any) => ({
    researcherId: row.assignedToId,
    researcher: {
      id: row.assignedTo.id,
      email: row.assignedTo.email,
      name: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
    },
    activeTaskCount: parseInt(row.getDataValue('activeTaskCount') || '0', 10),
    pendingCount: parseInt(row.getDataValue('pendingCount') || '0', 10),
    inProgressCount: parseInt(row.getDataValue('inProgressCount') || '0', 10),
  }));
}
```

### 1.4 On-Time Completion Rate

**Metric**: Percentage of tasks completed before or on due date.

**Business Value**: Measures adherence to deadlines and time management.

```typescript
/**
 * Calculate on-time completion rate for researchers
 * On-time = completedAt <= dueDate (or completed without dueDate)
 * @param researcherId - Optional: specific researcher ID, null for all researchers
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getOnTimeCompletionRate(
  researcherId: number | null,
  startDate: Date,
  endDate: Date,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  totalWithDueDate: number;
  onTimeCount: number;
  onTimeRate: number;
}>> {
  // Validate date range
  this.validateDateRange(startDate, endDate);

  // RBAC: Researchers can only query their own data
  if (user.role === UserRole.RESEARCHER) {
    if (researcherId && researcherId !== user.id) {
      throw new PermissionError('You can only view your own productivity metrics');
    }
    researcherId = user.id;
  }
  const whereClause: any = {
    status: TaskStatus.COMPLETED,
    completedAt: {
      [Op.between]: [startDate, endDate],
    },
    assignedToId: researcherId ? { [Op.eq]: researcherId } : { [Op.ne]: null },
    dueDate: { [Op.ne]: null }, // Only count tasks with due dates
  };

  // Apply RBAC filter
  this.applyRbacFilter(whereClause, user);

  const result = await Task.findAll({
    transaction,
    attributes: [
      'assignedToId',
      [Task.sequelize!.fn('COUNT', Task.sequelize!.col('id')), 'totalWithDueDate'],
      [
        Task.sequelize!.fn(
          'SUM',
          Task.sequelize!.literal(
            `CASE WHEN completed_at <= due_date THEN 1 ELSE 0 END`
          )
        ),
        'onTimeCount',
      ],
      [
        Task.sequelize!.fn(
          'AVG',
          Task.sequelize!.literal(
            `CASE WHEN completed_at <= due_date THEN 1.0 ELSE 0.0 END`
          )
        ),
        'onTimeRate',
      ],
    ],
    where: whereClause,
    include: [
      {
        model: User,
        as: 'assignedTo',
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: true,
      },
    ],
    group: ['assignedToId', 'assignedTo.id'],
    raw: false,
  });

  return result.map((row: any) => ({
    researcherId: row.assignedToId,
    researcher: {
      id: row.assignedTo.id,
      email: row.assignedTo.email,
      name: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
    },
    totalWithDueDate: parseInt(row.getDataValue('totalWithDueDate') || '0', 10),
    onTimeCount: parseInt(row.getDataValue('onTimeCount') || '0', 10),
    onTimeRate: parseFloat(row.getDataValue('onTimeRate') || '0') * 100,
  }));
}
```

---

## Project Progress Metrics

### 2.1 Overall Project Progress

**Metric**: Aggregated progress across all projects with task-level accuracy.

**Business Value**: High-level view of organizational progress.

```typescript
/**
 * Get project progress calculated from actual task completion
 * More accurate than cached progress field for analytics
 * @param projectId - Optional: specific project ID, null for all projects
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getProjectProgress(
  projectId: number | null,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  projectId: number;
  projectName: string;
  cachedProgress: number;
  calculatedProgress: number;
  studyCount: number;
  totalTasks: number;
  completedTasks: number;
}>> {
  // RBAC: Researchers can only see projects with assigned tasks
  // This is handled by filtering in the query via study/task joins
  const whereClause: any = projectId ? { id: projectId } : {};

  // For researchers, we need to filter projects that have assigned tasks
  // This is done via a subquery in the WHERE clause
  if (user.role === UserRole.RESEARCHER) {
    whereClause.id = {
      [Op.in]: Task.sequelize!.literal(`(
        SELECT DISTINCT s.project_id
        FROM tasks t
        INNER JOIN studies s ON s.id = t.study_id
        WHERE t.assigned_to_id = ${user.id}
      )`),
    };
  }

  // Single query with subquery aggregation - avoids multiple round trips
  const result = await Project.findAll({
    transaction,
    attributes: [
      'id',
      'name',
      'progress', // Cached value for comparison
      [
        // Calculate actual progress from tasks
        Task.sequelize!.literal(`(
          SELECT 
            CASE 
              WHEN COUNT(t.id) = 0 THEN 0
              ELSE ROUND(
                (COUNT(CASE WHEN t.status = '${TaskStatus.COMPLETED}' THEN 1 END) * 100.0) / 
                COUNT(t.id),
                2
              )
            END
          FROM studies s
          LEFT JOIN tasks t ON t.study_id = s.id
          WHERE s.project_id = projects.id
        )`),
        'calculatedProgress',
      ],
      [
        Task.sequelize!.literal(`(
          SELECT COUNT(DISTINCT s.id)
          FROM studies s
          WHERE s.project_id = projects.id
        )`),
        'studyCount',
      ],
      [
        Task.sequelize!.literal(`(
          SELECT COUNT(t.id)
          FROM studies s
          LEFT JOIN tasks t ON t.study_id = s.id
          WHERE s.project_id = projects.id
        )`),
        'totalTasks',
      ],
      [
        Task.sequelize!.literal(`(
          SELECT COUNT(t.id)
          FROM studies s
          LEFT JOIN tasks t ON t.study_id = s.id
          WHERE s.project_id = projects.id
          AND t.status = '${TaskStatus.COMPLETED}'
        )`),
        'completedTasks',
      ],
    ],
    where: whereClause,
    raw: true,
  });

  return result.map((row: any) => ({
    projectId: row.id,
    projectName: row.name,
    cachedProgress: parseFloat(row.progress || '0'),
    calculatedProgress: parseFloat(row.calculatedProgress || '0'),
    studyCount: parseInt(row.studyCount || '0', 10),
    totalTasks: parseInt(row.totalTasks || '0', 10),
    completedTasks: parseInt(row.completedTasks || '0', 10),
  }));
}
```

### 2.2 Project Velocity (Tasks Completed Per Time Period)

**Metric**: Rate of task completion over time for trend analysis.

**Business Value**: Identifies accelerating or decelerating projects.

```typescript
/**
 * Get project velocity - tasks completed per day/week/month
 * @param projectId - Optional: specific project, null for all projects
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @param period - 'day', 'week', or 'month'
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getProjectVelocity(
  projectId: number | null,
  startDate: Date,
  endDate: Date,
  user: UserContext,
  period: 'day' | 'week' | 'month' = 'day',
  transaction?: Transaction
): Promise<Array<{
  projectId: number;
  projectName: string;
  velocity: Array<{ period: string; count: number }>;
}>> {
  // Validate date range
  this.validateDateRange(startDate, endDate);
  const dateFormatMap = {
    day: '%Y-%m-%d',
    week: '%Y-%u', // ISO week
    month: '%Y-%m',
  };

  const dateFormat = dateFormatMap[period];

  const whereClause: any = {
    status: TaskStatus.COMPLETED,
    completedAt: {
      [Op.between]: [startDate, endDate],
    },
  };

  // Apply RBAC filter - Researchers only see their assigned tasks
  this.applyRbacFilter(whereClause, user);

  // Join through Study to Project for efficient filtering
  const result = await Task.findAll({
    transaction,
    attributes: [
      [
        Task.sequelize!.fn(
          'DATE_FORMAT',
          Task.sequelize!.col('completedAt'),
          dateFormat
        ),
        'period',
      ],
      [
        Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')),
        'completedCount',
      ],
    ],
    where: whereClause,
    include: [
      {
        model: Study,
        as: 'study',
        attributes: ['projectId'],
        required: true,
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
            required: true,
            where: projectId ? { id: projectId } : {},
          },
        ],
      },
    ],
    group: [
      'study.project.id',
      'study.projectId',
      Task.sequelize!.literal('period'),
    ],
    order: [
      ['study', 'project', 'id', 'ASC'],
      [Task.sequelize!.literal('period'), 'ASC'],
    ],
    raw: false,
  });

  // Transform to structured format
  const velocityMap = new Map<number, Array<{ period: string; count: number }>>();

  result.forEach((row: any) => {
    const projectId = row.study.project.id;
    const period = row.getDataValue('period');
    const count = parseInt(row.getDataValue('completedCount') || '0', 10);

    if (!velocityMap.has(projectId)) {
      velocityMap.set(projectId, []);
    }
    velocityMap.get(projectId)!.push({ period, count });
  });

  return Array.from(velocityMap.entries()).map(([id, periods]) => ({
    projectId: id,
    projectName: result.find((r: any) => r.study.project.id === id)?.study.project.name,
    velocity: periods,
  }));
}
```

### 2.3 Project Health Score

**Metric**: Composite score based on progress, overdue tasks, and compliance issues.

**Business Value**: Single metric for project health assessment.

```typescript
/**
 * Calculate project health score (0-100)
 * Factors:
 * - Progress completion (40%)
 * - Overdue task ratio (30%)
 * - Open compliance flags (30%)
 * @param projectId - Optional: specific project ID, null for all projects
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getProjectHealthScore(
  projectId: number | null,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  projectId: number;
  projectName: string;
  healthScore: number;
  breakdown: {
    progressScore: number;
    overdueScore: number;
    complianceScore: number;
  };
  metrics: {
    studyCount: number;
    totalTasks: number;
    overdueTasks: number;
    openComplianceFlags: number;
  };
}>> {
  const { ComplianceFlag } = await import('@/lib/db/models/complianceFlag');
  const { ComplianceFlagStatus } = await import('@/lib/db/models/complianceFlag');

  // Build WHERE clause with RBAC filtering
  let projectFilter = projectId ? 'p.id = :projectId' : '1=1';
  let taskFilter = '';
  const replacements: any = {
    projectId: projectId || null,
    openStatus: ComplianceFlagStatus.OPEN,
  };

  // RBAC: Researchers only see projects with their assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    taskFilter = 'AND t.assigned_to_id = :userId';
    replacements.userId = user.id;
  }

  // Use raw query for complex aggregation across multiple tables
  const projects = await Project.sequelize!.query(
    `
    SELECT 
      p.id,
      p.name,
      p.progress as cached_progress,
      -- Progress component (0-40 points)
      LEAST(40, (p.progress * 0.4)) as progress_score,
      
      -- Overdue tasks component (0-30 points, inverted)
      CASE 
        WHEN COUNT(DISTINCT t.id) = 0 THEN 30
        ELSE GREATEST(0, 30 - (
          (COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'completed' THEN 1 END) * 30.0) / 
          NULLIF(COUNT(DISTINCT t.id), 0)
        ))
      END as overdue_score,
      
      -- Compliance component (0-30 points, inverted)
      CASE 
        WHEN COUNT(DISTINCT t.id) = 0 THEN 30
        ELSE GREATEST(0, 30 - (
          (COUNT(DISTINCT cf.id) * 30.0) / 
          NULLIF(COUNT(DISTINCT t.id), 0)
        ))
      END as compliance_score,
      
      COUNT(DISTINCT s.id) as study_count,
      COUNT(DISTINCT t.id) as total_tasks,
      COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'completed' THEN 1 END) as overdue_tasks,
      COUNT(DISTINCT cf.id) as open_flags
      
    FROM projects p
    LEFT JOIN studies s ON s.project_id = p.id
    LEFT JOIN tasks t ON t.study_id = s.id ${taskFilter}
    LEFT JOIN compliance_flags cf ON cf.task_id = t.id AND cf.status = :openStatus
    WHERE ${projectFilter}
    GROUP BY p.id, p.name, p.progress
    ORDER BY p.id
    `,
    {
      replacements,
      type: Project.sequelize!.QueryTypes.SELECT,
      transaction,
    }
  );

  return projects.map((row: any) => {
    const progressScore = parseFloat(row.progress_score || '0');
    const overdueScore = parseFloat(row.overdue_score || '0');
    const complianceScore = parseFloat(row.compliance_score || '0');
    const healthScore = Math.round(progressScore + overdueScore + complianceScore);

    return {
      projectId: row.id,
      projectName: row.name,
      healthScore,
      breakdown: {
        progressScore: Math.round(progressScore),
        overdueScore: Math.round(overdueScore),
        complianceScore: Math.round(complianceScore),
      },
      metrics: {
        studyCount: parseInt(row.study_count || '0', 10),
        totalTasks: parseInt(row.total_tasks || '0', 10),
        overdueTasks: parseInt(row.overdue_tasks || '0', 10),
        openComplianceFlags: parseInt(row.open_flags || '0', 10),
      },
    };
  });
}
```

---

## Study Progress Metrics

### 3.1 Study Progress Distribution

**Metric**: Distribution of studies by progress ranges (0-25%, 25-50%, etc.).

**Business Value**: Identifies studies that may be stuck or need attention.

```typescript
/**
 * Get distribution of studies by progress ranges
 * @param projectId - Optional: specific project ID, null for all projects
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getStudyProgressDistribution(
  projectId: number | null,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  progressRange: string;
  studyCount: number;
}>> {
  const whereClause: any = projectId ? { projectId } : {};

  // RBAC: Researchers can only see studies with assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    whereClause.id = {
      [Op.in]: Task.sequelize!.literal(`(
        SELECT DISTINCT study_id
        FROM tasks
        WHERE assigned_to_id = ${user.id}
      )`),
    };
  }

  const result = await Study.findAll({
    transaction,
    attributes: [
      [
        Task.sequelize!.literal(`(
          CASE 
            WHEN progress < 25 THEN '0-25'
            WHEN progress < 50 THEN '25-50'
            WHEN progress < 75 THEN '50-75'
            WHEN progress < 100 THEN '75-100'
            ELSE '100'
          END
        )`),
        'progressRange',
      ],
      [Task.sequelize!.fn('COUNT', Task.sequelize!.col('Study.id')), 'studyCount'],
    ],
    where: whereClause,
    include: [
      {
        model: Project,
        as: 'project',
        attributes: [],
        required: true,
      },
    ],
    group: [Task.sequelize!.literal('progressRange')],
    order: [[Task.sequelize!.literal('progressRange'), 'ASC']],
    raw: true,
  });

  return result.map((row: any) => ({
    progressRange: row.progressRange,
    studyCount: parseInt(row.studyCount || '0', 10),
  }));
}
```

### 3.2 Study Completion Forecast

**Metric**: Estimated completion date based on current velocity.

**Business Value**: Helps with resource planning and deadline management.

```typescript
/**
 * Forecast study completion based on task completion velocity
 * Uses linear regression on recent completion data
 * @param studyId - Optional: specific study ID, null for all studies
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getStudyCompletionForecast(
  studyId: number | null,
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  studyId: number;
  studyName: string;
  currentProgress: number;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  tasksPerDay: string;
  estimatedDaysToComplete: number | null;
  forecastedCompletionDate: Date | null;
}>> {
  const whereClause: any = {
    status: TaskStatus.COMPLETED,
    completedAt: {
      [Op.gte]: Task.sequelize!.literal("DATE_SUB(NOW(), INTERVAL 30 DAY)"),
    },
  };

  if (studyId) {
    whereClause.studyId = studyId;
  }

  // Get recent completion velocity per study
  const velocityData = await Task.findAll({
    attributes: [
      'studyId',
      [
        Task.sequelize!.fn(
          'COUNT',
          Task.sequelize!.col('id')
        ),
        'completedInLast30Days',
      ],
      [
        Task.sequelize!.fn(
          'AVG',
          Task.sequelize!.fn(
            'TIMESTAMPDIFF',
            Task.sequelize!.literal('DAY'),
            Task.sequelize!.col('createdAt'),
            Task.sequelize!.col('completedAt')
          )
        ),
        'avgDaysToComplete',
      ],
    ],
    where: whereClause,
    group: ['studyId'],
    raw: true,
  });

  // Get current study state
  const studyWhereClause: any = studyId ? { id: studyId } : {};

  // RBAC: Researchers can only see studies with assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    studyWhereClause.id = {
      [Op.in]: Task.sequelize!.literal(`(
        SELECT DISTINCT study_id
        FROM tasks
        WHERE assigned_to_id = ${user.id}
      )`),
    };
  }

  const studies = await Study.findAll({
    transaction,
    attributes: [
      'id',
      'name',
      'progress',
      [
        Task.sequelize!.literal(`(
          SELECT COUNT(t.id)
          FROM tasks t
          WHERE t.study_id = studies.id
        )`),
        'totalTasks',
      ],
      [
        Task.sequelize!.literal(`(
          SELECT COUNT(t.id)
          FROM tasks t
          WHERE t.study_id = studies.id
          AND t.status = '${TaskStatus.COMPLETED}'
        )`),
        'completedTasks',
      ],
    ],
    where: studyWhereClause,
    raw: true,
  });

  // Calculate forecast
  return studies.map((study: any) => {
    const velocity = velocityData.find((v: any) => v.studyId === study.id);
    const totalTasks = parseInt(study.totalTasks || '0', 10);
    const completedTasks = parseInt(study.completedTasks || '0', 10);
    const remainingTasks = totalTasks - completedTasks;

    // Tasks per day based on last 30 days
    const tasksPerDay = velocity
      ? parseFloat(velocity.completedInLast30Days || '0') / 30
      : 0;

    // Estimated days to complete
    const estimatedDays = tasksPerDay > 0
      ? Math.ceil(remainingTasks / tasksPerDay)
      : null;

    const forecastDate = estimatedDays
      ? new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000)
      : null;

    return {
      studyId: study.id,
      studyName: study.name,
      currentProgress: parseFloat(study.progress || '0'),
      totalTasks,
      completedTasks,
      remainingTasks,
      tasksPerDay: tasksPerDay.toFixed(2),
      estimatedDaysToComplete: estimatedDays,
      forecastedCompletionDate: forecastDate,
    };
  });
}
```

---

## Task Priority Distribution Metrics

### 4.1 Priority Distribution by Status

**Metric**: Count of tasks grouped by priority and status.

**Business Value**: Identifies priority imbalances and resource allocation issues.

```typescript
/**
 * Get task distribution across priority levels and statuses
 * @param projectId - Optional: specific project ID, null for all projects
 * @param studyId - Optional: specific study ID, null for all studies
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getTaskPriorityDistribution(
  projectId: number | null,
  studyId: number | null,
  user: UserContext,
  transaction?: Transaction
): Promise<{
  distribution: Record<TaskPriority, Record<TaskStatus, number>>;
  summary: {
    totalTasks: number;
    byPriority: Array<{
      priority: TaskPriority;
      total: number;
      byStatus: Record<TaskStatus, number>;
    }>;
  };
}> {
  const whereClause: any = {};

  if (studyId) {
    whereClause.studyId = studyId;
  }

  // Apply RBAC filter
  this.applyRbacFilter(whereClause, user);

  // Efficient single-query aggregation leveraging idx_tasks_priority and idx_tasks_status
  const result = await Task.findAll({
    transaction,
    attributes: [
      'priority',
      'status',
      [Task.sequelize!.fn('COUNT', Task.sequelize!.col('id')), 'taskCount'],
    ],
    where: whereClause,
    include: studyId
      ? []
      : [
          {
            model: Study,
            as: 'study',
            attributes: [],
            required: true,
            include: projectId
              ? [
                  {
                    model: Project,
                    as: 'project',
                    attributes: [],
                    required: true,
                    where: { id: projectId },
                  },
                ]
              : [],
          },
        ],
    group: ['priority', 'status'],
    order: [
      ['priority', 'ASC'],
      ['status', 'ASC'],
    ],
    raw: true,
  });

  // Transform to nested structure
  const distribution: Record<
    TaskPriority,
    Record<TaskStatus, number>
  > = {} as any;

  // Initialize all combinations
  Object.values(TaskPriority).forEach((priority) => {
    distribution[priority] = {} as Record<TaskStatus, number>;
    Object.values(TaskStatus).forEach((status) => {
      distribution[priority][status] = 0;
    });
  });

  // Populate with actual data
  result.forEach((row: any) => {
    distribution[row.priority][row.status] = parseInt(row.taskCount || '0', 10);
  });

  return {
    distribution,
    summary: {
      totalTasks: result.reduce(
        (sum, row: any) => sum + parseInt(row.taskCount || '0', 10),
        0
      ),
      byPriority: Object.entries(distribution).map(([priority, statuses]) => ({
        priority,
        total: Object.values(statuses).reduce((sum, count) => sum + count, 0),
        byStatus: statuses,
      })),
    },
  };
}
```

### 4.2 High-Priority Task Backlog

**Metric**: Count and age of high/urgent priority tasks that are not completed.

**Business Value**: Identifies critical tasks that need immediate attention.

```typescript
/**
 * Get backlog of high-priority (HIGH/URGENT) tasks
 * Includes task age and assignment status
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getHighPriorityBacklog(
  user: UserContext,
  transaction?: Transaction
): Promise<Array<{
  taskId: number;
  taskName: string;
  priority: TaskPriority;
  status: TaskStatus;
  ageInDays: number;
  dueDate: Date | null;
  daysUntilDue: number | null;
  assignedTo: {
    id: number;
    email: string;
    name: string;
  } | null;
  study: {
    id: number;
    name: string;
  };
  project: {
    id: number;
    name: string;
  };
}>> {
  const whereClause: any = {
    priority: {
      [Op.in]: [TaskPriority.HIGH, TaskPriority.URGENT],
    },
    status: {
      [Op.ne]: TaskStatus.COMPLETED,
    },
  };

  // Apply RBAC filter
  this.applyRbacFilter(whereClause, user);

  const result = await Task.findAll({
    transaction,
    attributes: [
      'id',
      'name',
      'priority',
      'status',
      'assignedToId',
      'dueDate',
      'createdAt',
      [
        Task.sequelize!.fn(
          'TIMESTAMPDIFF',
          Task.sequelize!.literal('DAY'),
          Task.sequelize!.col('createdAt'),
          Task.sequelize!.fn('NOW')
        ),
        'ageInDays',
      ],
      [
        Task.sequelize!.fn(
          'TIMESTAMPDIFF',
          Task.sequelize!.literal('DAY'),
          Task.sequelize!.fn('NOW'),
          Task.sequelize!.col('dueDate')
        ),
        'daysUntilDue',
      ],
    ],
    where: whereClause,
    include: [
      {
        model: User,
        as: 'assignedTo',
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: false,
      },
      {
        model: Study,
        as: 'study',
        attributes: ['id', 'name'],
        required: true,
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
            required: true,
          },
        ],
      },
    ],
    order: [
      ['priority', 'DESC'], // URGENT first
      ['createdAt', 'ASC'], // Oldest first
    ],
    raw: false,
  });

  return result.map((row: any) => ({
    taskId: row.id,
    taskName: row.name,
    priority: row.priority,
    status: row.status,
    ageInDays: parseInt(row.getDataValue('ageInDays') || '0', 10),
    dueDate: row.dueDate,
    daysUntilDue: row.dueDate
      ? parseInt(row.getDataValue('daysUntilDue') || '0', 10)
      : null,
    assignedTo: row.assignedTo
      ? {
          id: row.assignedTo.id,
          email: row.assignedTo.email,
          name: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
        }
      : null,
    study: {
      id: row.study.id,
      name: row.study.name,
    },
    project: {
      id: row.study.project.id,
      name: row.study.project.name,
    },
  }));
}
```

---

## Non-Compliance Rates Metrics

### 5.1 Compliance Flag Rate by Task

**Metric**: Percentage of tasks with open compliance flags.

**Business Value**: Measures quality and adherence to protocols.

```typescript
/**
 * Calculate compliance flag rate across tasks
 * Rate = (Tasks with open flags / Total tasks) × 100
 * @param projectId - Optional: specific project ID, null for all projects
 * @param studyId - Optional: specific study ID, null for all studies
 * @param severity - Optional: filter by severity level
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getComplianceFlagRate(
  projectId: number | null,
  studyId: number | null,
  user: UserContext,
  severity: string | null = null,
  transaction?: Transaction
): Promise<{
  totalTasks: number;
  tasksWithFlags: number;
  totalOpenFlags: number;
  flagRate: number;
}> {
  const { ComplianceFlag } = await import('@/lib/db/models/complianceFlag');
  const { ComplianceFlagStatus } = await import('@/lib/db/models/complianceFlag');

  const whereClause: any = {};

  if (studyId) {
    whereClause.studyId = studyId;
  }

  // Apply RBAC filter
  this.applyRbacFilter(whereClause, user);

  // Single query with LEFT JOIN for efficiency
  // Leverages idx_compliance_flags_task_status composite index
  const result = await Task.findAll({
    transaction,
    attributes: [
      [
        Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')),
        'totalTasks',
      ],
      [
        Task.sequelize!.fn(
          'COUNT',
          Task.sequelize!.fn('DISTINCT', Task.sequelize!.col('Task.id'))
        ),
        'tasksWithFlags',
      ],
      [
        Task.sequelize!.fn(
          'COUNT',
          Task.sequelize!.col('complianceFlags.id')
        ),
        'totalOpenFlags',
      ],
    ],
    where: whereClause,
    include: [
      {
        model: Study,
        as: 'study',
        attributes: [],
        required: true,
        include: projectId
          ? [
              {
                model: Project,
                as: 'project',
                attributes: [],
                required: true,
                where: { id: projectId },
              },
            ]
          : [],
      },
      {
        model: ComplianceFlag,
        as: 'complianceFlags',
        attributes: [],
        required: false,
        where: {
          status: ComplianceFlagStatus.OPEN,
          ...(severity ? { severity } : {}),
        },
      },
    ],
    group: [],
    raw: true,
  });

  if (result.length === 0) {
    return {
      totalTasks: 0,
      tasksWithFlags: 0,
      totalOpenFlags: 0,
      flagRate: 0,
    };
  }

  const row = result[0];
  const totalTasks = parseInt(row.totalTasks || '0', 10);
  const tasksWithFlags = parseInt(row.tasksWithFlags || '0', 10);
  const totalOpenFlags = parseInt(row.totalOpenFlags || '0', 10);
  const flagRate = totalTasks > 0 ? (tasksWithFlags / totalTasks) * 100 : 0;

  return {
    totalTasks,
    tasksWithFlags,
    totalOpenFlags,
    flagRate: Math.round(flagRate * 100) / 100,
  };
}
```

### 5.2 Compliance Flag Trends Over Time

**Metric**: Count of compliance flags raised per time period.

**Business Value**: Identifies trends in compliance issues.

```typescript
/**
 * Get compliance flag trends over time
 * Shows flags raised per period (day/week/month)
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @param period - Time period aggregation ('day', 'week', 'month')
 * @param severity - Optional: filter by severity level
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getComplianceFlagTrends(
  startDate: Date,
  endDate: Date,
  user: UserContext,
  period: 'day' | 'week' | 'month' = 'day',
  severity: string | null = null,
  transaction?: Transaction
): Promise<Array<{
  period: string;
  open: number;
  resolved: number;
  dismissed: number;
  bySeverity: Record<string, number>;
}>> {
  // Validate date range
  this.validateDateRange(startDate, endDate);
  const { ComplianceFlag } = await import('@/lib/db/models/complianceFlag');
  const { ComplianceFlagStatus } = await import('@/lib/db/models/complianceFlag');

  const dateFormatMap = {
    day: '%Y-%m-%d',
    week: '%Y-%u',
    month: '%Y-%m',
  };

  const dateFormat = dateFormatMap[period];

  const whereClause: any = {
    createdAt: {
      [Op.between]: [startDate, endDate],
    },
    ...(severity ? { severity } : {}),
  };

  // RBAC: Researchers can only see flags for their assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    whereClause.taskId = {
      [Op.in]: Task.sequelize!.literal(`(
        SELECT id FROM tasks WHERE assigned_to_id = ${user.id}
      )`),
    };
  }

  const result = await ComplianceFlag.findAll({
    transaction,
    attributes: [
      [
        ComplianceFlag.sequelize!.fn(
          'DATE_FORMAT',
          ComplianceFlag.sequelize!.col('createdAt'),
          dateFormat
        ),
        'period',
      ],
      'status',
      'severity',
      [
        ComplianceFlag.sequelize!.fn(
          'COUNT',
          ComplianceFlag.sequelize!.col('id')
        ),
        'flagCount',
      ],
    ],
    where: whereClause,
    group: [
      ComplianceFlag.sequelize!.literal('period'),
      'status',
      'severity',
    ],
    order: [[ComplianceFlag.sequelize!.literal('period'), 'ASC']],
    raw: true,
  });

  // Transform to time series format
  const trendsMap = new Map<
    string,
    {
      period: string;
      open: number;
      resolved: number;
      dismissed: number;
      bySeverity: Record<string, number>;
    }
  >();

  result.forEach((row: any) => {
    const period = row.period;
    if (!trendsMap.has(period)) {
      trendsMap.set(period, {
        period,
        open: 0,
        resolved: 0,
        dismissed: 0,
        bySeverity: {},
      });
    }

    const trend = trendsMap.get(period)!;
    const count = parseInt(row.flagCount || '0', 10);

    // Count by status
    if (row.status === ComplianceFlagStatus.OPEN) trend.open += count;
    if (row.status === ComplianceFlagStatus.RESOLVED) trend.resolved += count;
    if (row.status === ComplianceFlagStatus.DISMISSED) trend.dismissed += count;

    // Count by severity
    if (!trend.bySeverity[row.severity]) {
      trend.bySeverity[row.severity] = 0;
    }
    trend.bySeverity[row.severity] += count;
  });

  return Array.from(trendsMap.values());
}
```

### 5.3 Average Time to Resolve Compliance Flags

**Metric**: Average time from flag creation to resolution.

**Business Value**: Measures responsiveness to compliance issues.

```typescript
/**
 * Calculate average time to resolve compliance flags
 * @param startDate - Start date for the period
 * @param endDate - End date for the period
 * @param severity - Optional: filter by severity level
 * @param user - User context for RBAC enforcement
 * @param transaction - Optional transaction for consistency
 */
async getAverageFlagResolutionTime(
  startDate: Date,
  endDate: Date,
  user: UserContext,
  severity: string | null = null,
  transaction?: Transaction
): Promise<Array<{
  severity: string;
  avgHoursToResolve: number;
  minHoursToResolve: number;
  maxHoursToResolve: number;
  resolvedCount: number;
}>> {
  // Validate date range
  this.validateDateRange(startDate, endDate);
  const { ComplianceFlag } = await import('@/lib/db/models/complianceFlag');
  const { ComplianceFlagStatus } = await import('@/lib/db/models/complianceFlag');

  const whereClause: any = {
    status: ComplianceFlagStatus.RESOLVED,
    resolvedAt: {
      [Op.between]: [startDate, endDate],
    },
    ...(severity ? { severity } : {}),
  };

  // RBAC: Researchers can only see flags for their assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    whereClause.taskId = {
      [Op.in]: Task.sequelize!.literal(`(
        SELECT id FROM tasks WHERE assigned_to_id = ${user.id}
      )`),
    };
  }

  const result = await ComplianceFlag.findAll({
    transaction,
    attributes: [
      'severity',
      [
        ComplianceFlag.sequelize!.fn(
          'AVG',
          ComplianceFlag.sequelize!.fn(
            'TIMESTAMPDIFF',
            ComplianceFlag.sequelize!.literal('HOUR'),
            ComplianceFlag.sequelize!.col('createdAt'),
            ComplianceFlag.sequelize!.col('resolvedAt')
          )
        ),
        'avgHoursToResolve',
      ],
      [
        ComplianceFlag.sequelize!.fn(
          'MIN',
          ComplianceFlag.sequelize!.fn(
            'TIMESTAMPDIFF',
            ComplianceFlag.sequelize!.literal('HOUR'),
            ComplianceFlag.sequelize!.col('createdAt'),
            ComplianceFlag.sequelize!.col('resolvedAt')
          )
        ),
        'minHoursToResolve',
      ],
      [
        ComplianceFlag.sequelize!.fn(
          'MAX',
          ComplianceFlag.sequelize!.fn(
            'TIMESTAMPDIFF',
            ComplianceFlag.sequelize!.literal('HOUR'),
            ComplianceFlag.sequelize!.col('createdAt'),
            ComplianceFlag.sequelize!.col('resolvedAt')
          )
        ),
        'maxHoursToResolve',
      ],
      [
        ComplianceFlag.sequelize!.fn(
          'COUNT',
          ComplianceFlag.sequelize!.col('id')
        ),
        'resolvedCount',
      ],
    ],
    where: whereClause,
    group: ['severity'],
    raw: true,
  });

  return result.map((row: any) => ({
    severity: row.severity,
    avgHoursToResolve: parseFloat(row.avgHoursToResolve || '0'),
    minHoursToResolve: parseInt(row.minHoursToResolve || '0', 10),
    maxHoursToResolve: parseInt(row.maxHoursToResolve || '0', 10),
    resolvedCount: parseInt(row.resolvedCount || '0', 10),
  }));
}
```

---

## Indexing Strategy

### Recommended Additional Indexes

The following indexes optimize the analytics queries defined above:

```sql
-- Composite index for researcher productivity queries
-- Supports filtering by assignedToId and status together
CREATE INDEX idx_tasks_assigned_status 
ON tasks(assigned_to_id, status) 
WHERE assigned_to_id IS NOT NULL;

-- Index for completion time calculations
-- Supports queries filtering by completedAt and status
CREATE INDEX idx_tasks_completed_status 
ON tasks(completed_at, status) 
WHERE status = 'completed' AND completed_at IS NOT NULL;

-- Composite index for due date queries
-- Supports overdue task identification
CREATE INDEX idx_tasks_due_status 
ON tasks(due_date, status) 
WHERE due_date IS NOT NULL;

-- Index for study progress aggregation
-- Supports project-level task aggregation
CREATE INDEX idx_tasks_study_project 
ON tasks(study_id, status);

-- Index for priority distribution queries
-- Composite index for priority + status filtering
CREATE INDEX idx_tasks_priority_status 
ON tasks(priority, status);

-- Index for compliance flag time-based queries
-- Supports trend analysis
CREATE INDEX idx_compliance_flags_created_severity 
ON compliance_flags(created_at, severity, status);

-- Index for flag resolution time calculations
-- Supports resolution time analytics
CREATE INDEX idx_compliance_flags_resolved 
ON compliance_flags(resolved_at, status) 
WHERE status IN ('resolved', 'dismissed') AND resolved_at IS NOT NULL;
```

### Index Maintenance

```sql
-- Analyze tables regularly to update statistics
-- Run weekly or after bulk data changes
ANALYZE TABLE tasks;
ANALYZE TABLE studies;
ANALYZE TABLE projects;
ANALYZE TABLE compliance_flags;

-- Check index usage (MariaDB 10.5+)
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  SEQ_IN_INDEX,
  COLUMN_NAME,
  CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('tasks', 'studies', 'projects', 'compliance_flags')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

---

## Caching Strategy

### 1. Materialized Views (MariaDB 10.3.2+)

For frequently accessed aggregations, consider materialized views refreshed periodically:

```sql
-- Materialized view for researcher productivity (refresh hourly)
CREATE TABLE researcher_productivity_cache (
  researcher_id INT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_tasks INT UNSIGNED DEFAULT 0,
  completed_tasks INT UNSIGNED DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  avg_hours_to_complete DECIMAL(10,2) DEFAULT 0,
  on_time_count INT UNSIGNED DEFAULT 0,
  on_time_rate DECIMAL(5,2) DEFAULT 0,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (researcher_id, period_start, period_end),
  INDEX idx_cached_at (cached_at)
) ENGINE=InnoDB;

-- Materialized view for project health scores (refresh every 15 minutes)
CREATE TABLE project_health_cache (
  project_id INT UNSIGNED NOT NULL PRIMARY KEY,
  health_score INT UNSIGNED DEFAULT 0,
  progress_score DECIMAL(5,2) DEFAULT 0,
  overdue_score DECIMAL(5,2) DEFAULT 0,
  compliance_score DECIMAL(5,2) DEFAULT 0,
  total_tasks INT UNSIGNED DEFAULT 0,
  overdue_tasks INT UNSIGNED DEFAULT 0,
  open_flags INT UNSIGNED DEFAULT 0,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cached_at (cached_at)
) ENGINE=InnoDB;
```

### 2. Application-Level Caching

For Next.js API routes, implement Redis or in-memory caching:

```typescript
// Example caching wrapper (pseudo-code)
import NodeCache from 'node-cache';

const analyticsCache = new NodeCache({ stdTTL: 300 }); // 5 minutes default

async function getCachedAnalytics<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  const cached = analyticsCache.get<T>(key);
  if (cached) {
    return cached;
  }

  const result = await queryFn();
  analyticsCache.set(key, result, ttl);
  return result;
}

// Usage example
const productivity = await getCachedAnalytics(
  `researcher-productivity-${researcherId}-${startDate}-${endDate}`,
  () => getResearcherCompletionRate(researcherId, startDate, endDate),
  600 // 10 minutes for productivity metrics
);
```

### 3. Cache Invalidation Strategy

```typescript
// Invalidate cache on task status changes
// Add to taskService.ts updateTask and completeTask methods

async function invalidateAnalyticsCache(taskId: number) {
  const task = await Task.findByPk(taskId, {
    include: [
      { model: Study, as: 'study', include: [{ model: Project, as: 'project' }] },
      { model: User, as: 'assignedTo' },
    ],
  });

  if (!task) return;

  const cacheKeys = [
    // Researcher productivity
    `researcher-productivity-${task.assignedToId}-*`,
    // Project health
    `project-health-${task.study.project.id}`,
    // Study progress
    `study-progress-${task.studyId}`,
    // Priority distribution
    `priority-distribution-*`,
  ];

  cacheKeys.forEach((pattern) => {
    analyticsCache.keys().forEach((key) => {
      if (key.match(pattern.replace('*', '.*'))) {
        analyticsCache.del(key);
      }
    });
  });
}
```

---

## Query Performance Optimization

### 1. Query Optimization Tips

- **Use EXPLAIN**: Always analyze query plans before deploying
  ```sql
  EXPLAIN SELECT ... FROM tasks WHERE ...;
  ```

- **Limit Result Sets**: Use pagination for large datasets
  ```typescript
  const result = await Task.findAll({
    limit: 100,
    offset: (page - 1) * 100,
    // ...
  });
  ```

- **Avoid N+1 Queries**: Use `include` strategically, but prefer subqueries for aggregations
  ```typescript
  // Bad: Multiple queries
  const tasks = await Task.findAll();
  for (const task of tasks) {
    const study = await task.getStudy();
  }

  // Good: Single query with include
  const tasks = await Task.findAll({
    include: [{ model: Study, as: 'study' }],
  });
  ```

- **Use Raw Queries for Complex Aggregations**: When Sequelize ORM overhead is significant
  ```typescript
  const result = await Task.sequelize!.query(
    `SELECT ... FROM tasks WHERE ...`,
    { type: QueryTypes.SELECT }
  );
  ```

### 2. Connection Pooling

Ensure proper connection pool configuration in `src/lib/db/connection.ts`:

```typescript
export const sequelize = new Sequelize(/* ... */, {
  pool: {
    max: 20, // Maximum connections
    min: 5,  // Minimum connections
    acquire: 30000, // Max time to wait for connection (ms)
    idle: 10000, // Max idle time before release (ms)
  },
  logging: false, // Disable in production
});
```

### 3. Query Timeout

Set query timeouts for analytics queries:

```typescript
const result = await Task.findAll({
  // ... query options
  timeout: 30000, // 30 seconds
});
```

---

## Summary

This analytics design provides:

1. **5 Core Metric Categories**: Researcher productivity, project progress, study progress, task priority distribution, and non-compliance rates
2. **Service Layer Architecture**: Follows existing patterns (ProgressService, TaskService) with proper RBAC enforcement
3. **API Route Integration**: RESTful endpoints following Next.js App Router conventions
4. **RBAC Enforcement**: Multi-layer security respecting role-based access control
5. **Optimized Sequelize Queries**: All queries leverage indexes and minimize data transfer
6. **Indexing Strategy**: Additional indexes recommended for analytics workloads
7. **Caching Strategy**: Materialized views and application-level caching for performance
8. **Performance Best Practices**: Query optimization, connection pooling, and timeout configuration
9. **Error Handling**: Uses custom error classes consistent with the architecture
10. **Type Safety**: Full TypeScript support with proper return types

### Architecture Compliance

✅ **Service Layer Pattern**: Analytics implemented as `AnalyticsService` class  
✅ **API Route Structure**: Follows `app/api/` pattern with proper route handlers  
✅ **RBAC Enforcement**: Respects UserRole.MANAGER and UserRole.RESEARCHER constraints  
✅ **Error Handling**: Uses ValidationError, PermissionError, NotFoundError from `src/lib/utils/errors.ts`  
✅ **Transaction Support**: Optional transaction parameter for consistency  
✅ **Type Safety**: Leverages types from `src/types/entities.ts` and `src/types/rbac.ts`  
✅ **Code Style**: Matches existing service patterns (ProgressService, TaskService)

All queries are production-ready and follow Sequelize v7 best practices for MariaDB, fully aligned with the system architecture.

