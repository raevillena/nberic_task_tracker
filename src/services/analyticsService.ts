// Analytics service - Business logic for analytics metrics

import { Transaction } from 'sequelize';
import { Task, User, Study, Project, ComplianceFlag } from '@/lib/db/models';
import { ComplianceFlagStatus } from '@/lib/db/models/complianceFlag';
import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';
import { UserContext } from '@/types/rbac';
import { PermissionError, ValidationError } from '@/lib/utils/errors';
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

  /**
   * Get task completion rate for a researcher or all researchers
   */
  async getResearcherCompletionRate(
    researcherId: number | null,
    startDate: Date,
    endDate: Date,
    user: UserContext,
    transaction?: Transaction
  ) {
    this.validateDateRange(startDate, endDate);

    if (user.role === UserRole.RESEARCHER) {
      if (researcherId && researcherId !== user.id) {
        throw new PermissionError('You can only view your own productivity metrics');
      }
      researcherId = user.id;
    }

    const whereClause: any = {
      assignedToId: researcherId ? { [Op.eq]: researcherId } : { [Op.ne]: null },
      // Only filter by date if we have a date range - otherwise show all tasks
      ...(startDate && endDate
        ? {
      createdAt: {
        [Op.between]: [startDate, endDate],
      },
          }
        : {}),
    };

    this.applyRbacFilter(whereClause, user);

    const result = await Task.findAll({
      transaction,
      attributes: [
        'assignedToId',
        [Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')), 'totalTasks'],
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

    return result.map((row: any) => {
      try {
        return {
      researcherId: row.assignedToId,
      researcher: {
            id: row.assignedTo?.id,
            email: row.assignedTo?.email,
            name: `${row.assignedTo?.firstName || ''} ${row.assignedTo?.lastName || ''}`.trim(),
          },
          totalTasks: parseInt(String(row.getDataValue?.('totalTasks') || row.totalTasks || '0'), 10),
          completedTasks: parseInt(String(row.getDataValue?.('completedTasks') || row.completedTasks || '0'), 10),
          completionRate: parseFloat(String(row.getDataValue?.('completionRate') || row.completionRate || '0')) * 100,
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing productivity row:', { row, error: err });
        throw err;
      }
    });
  }

  /**
   * Get current workload distribution across researchers
   */
  async getResearcherWorkload(
    user: UserContext,
    transaction?: Transaction
  ) {
    const whereClause: any = {
      assignedToId: { [Op.ne]: null },
      status: {
        [Op.in]: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
      },
    };

    this.applyRbacFilter(whereClause, user);

    const result = await Task.findAll({
      transaction,
      attributes: [
        'assignedToId',
        [
          Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')),
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

    return result.map((row: any) => {
      try {
        return {
      researcherId: row.assignedToId,
      researcher: {
            id: row.assignedTo?.id,
            email: row.assignedTo?.email,
            name: `${row.assignedTo?.firstName || ''} ${row.assignedTo?.lastName || ''}`.trim(),
          },
          activeTaskCount: parseInt(String(row.getDataValue?.('activeTaskCount') || row.activeTaskCount || '0'), 10),
          pendingCount: parseInt(String(row.getDataValue?.('pendingCount') || row.pendingCount || '0'), 10),
          inProgressCount: parseInt(String(row.getDataValue?.('inProgressCount') || row.inProgressCount || '0'), 10),
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing workload row:', { row, error: err });
        throw err;
      }
    });
  }

  /**
   * Get project progress calculated from actual task completion
   */
  async getProjectProgress(
    projectId: number | null,
    user: UserContext,
    transaction?: Transaction
  ) {
    // For Managers: show all projects (even without tasks)
    // For Researchers: show only projects with assigned tasks
    let whereClause: any = projectId ? { id: projectId } : {};

    if (user.role === UserRole.RESEARCHER) {
      // Researchers see projects that have tasks assigned to them
      whereClause.id = {
        [Op.in]: Task.sequelize!.literal(`(
          SELECT DISTINCT s.project_id
          FROM tasks t
          INNER JOIN studies s ON s.id = t.study_id
          WHERE t.assigned_to_id = ${user.id}
        )`),
      };
    }

    try {
      // Use a simpler approach: get projects first, then calculate metrics
      // This avoids issues with correlated subqueries in Sequelize
      const projects = await Project.findAll({
        transaction,
        attributes: ['id', 'name', 'progress'],
        where: whereClause,
        raw: false,
      });

      if (projects.length === 0) {
        return [];
      }

      const projectIds = projects.map((p) => p.id);

      // Get study counts per project
      const studies = await Study.findAll({
      transaction,
      attributes: [
          'projectId',
          [Task.sequelize!.fn('COUNT', Task.sequelize!.col('id')), 'studyCount'],
        ],
        where: { projectId: { [Op.in]: projectIds } },
        group: ['projectId'],
        raw: true,
      });

      const studyCountMap = new Map<number, number>();
      studies.forEach((s: any) => {
        studyCountMap.set(s.projectId, parseInt(s.studyCount || '0', 10));
      });

      // Get all studies for these projects
      const allStudies = await Study.findAll({
        transaction,
        attributes: ['id', 'projectId'],
        where: { projectId: { [Op.in]: projectIds } },
        raw: true,
      });

      const studyIds = allStudies.map((s: any) => s.id);
      const studyToProjectMap = new Map<number, number>();
      allStudies.forEach((s: any) => {
        studyToProjectMap.set(s.id, s.projectId);
      });

      // Get task counts per study, then aggregate by project
      const taskStats = studyIds.length > 0
        ? await Task.findAll({
            transaction,
            attributes: [
              'studyId',
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
      ],
            where: { studyId: { [Op.in]: studyIds } },
            group: ['studyId'],
      raw: true,
          })
        : [];

      // Aggregate task stats by project
      const taskStatsMap = new Map<number, { total: number; completed: number }>();
      taskStats.forEach((stat: any) => {
        const studyId = parseInt(stat.studyId || '0', 10);
        const projectId = studyToProjectMap.get(studyId);
        if (projectId) {
          const existing = taskStatsMap.get(projectId) || { total: 0, completed: 0 };
          taskStatsMap.set(projectId, {
            total: existing.total + parseInt(stat.totalTasks || '0', 10),
            completed: existing.completed + parseInt(stat.completedTasks || '0', 10),
          });
        }
      });

      // Combine results
      const result = projects.map((project) => {
        const studyCount = studyCountMap.get(project.id) || 0;
        const taskStat = taskStatsMap.get(project.id) || { total: 0, completed: 0 };
        const calculatedProgress =
          taskStat.total > 0 ? Math.round((taskStat.completed / taskStat.total) * 100 * 100) / 100 : 0;

        return {
          projectId: project.id,
          projectName: project.name,
          cachedProgress: parseFloat(String(project.progress || '0')),
          calculatedProgress,
          studyCount,
          totalTasks: taskStat.total,
          completedTasks: taskStat.completed,
        };
      });

      // Debug: Log results
      console.log(`[AnalyticsService] getProjectProgress: Found ${result.length} projects for user ${user.role} (${user.id})`);
      if (result.length > 0) {
        console.log(`[AnalyticsService] Projects:`, result.map((r) => ({ id: r.projectId, name: r.projectName, studies: r.studyCount })));
      } else if (user.role === UserRole.MANAGER) {
        console.warn('[AnalyticsService] No projects found for Manager - checking if projects exist in database...');
        // Quick check: try to get projects without analytics
        const allProjects = await Project.findAll({ limit: 5, attributes: ['id', 'name'] });
        console.log(`[AnalyticsService] Total projects in DB: ${allProjects.length}`);
      }

      return result;
    } catch (error) {
      console.error('[AnalyticsService] Error in getProjectProgress:', error);
      throw error;
    }

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

  /**
   * Get task distribution across priority levels and statuses
   */
  async getTaskPriorityDistribution(
    projectId: number | null,
    studyId: number | null,
    user: UserContext,
    transaction?: Transaction
  ) {
    const whereClause: any = {};

    if (studyId) {
      whereClause.studyId = studyId;
    }

    this.applyRbacFilter(whereClause, user);

    // Always use raw: true for GROUP BY queries to get consistent data structure
    // When using raw: false with GROUP BY, Sequelize doesn't return data in expected format
    const useRaw = true;

    const result = await Task.findAll({
      transaction,
      attributes: [
        'priority',
        'status',
        [Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')), 'taskCount'],
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
      raw: useRaw,
    });

    const distribution: Record<
      TaskPriority,
      Record<TaskStatus, number>
    > = {} as any;

    Object.values(TaskPriority).forEach((priority) => {
      distribution[priority] = {} as Record<TaskStatus, number>;
      Object.values(TaskStatus).forEach((status) => {
        distribution[priority][status] = 0;
      });
    });

    result.forEach((row: any) => {
      try {
        // With raw: true, data is a plain object
        // Column names might be prefixed with table alias when using includes
        const priority = row.priority || row['Task.priority'] || row['tasks.priority'];
        const status = row.status || row['Task.status'] || row['tasks.status'];
        const taskCount = parseInt(String(row.taskCount || row['taskCount'] || '0'), 10);
        
        if (priority && status && (priority in distribution) && (status in distribution[priority])) {
          distribution[priority as TaskPriority][status as TaskStatus] = taskCount;
        }
      } catch (err) {
        console.error('[AnalyticsService] Error processing priority row:', { row, error: err });
      }
    });

    const totalTasks = result.reduce(
      (sum, row: any) => {
        try {
          const taskCount = row.taskCount || row['taskCount'] || 0;
          return sum + parseInt(String(taskCount || '0'), 10);
        } catch (err) {
          console.error('[AnalyticsService] Error calculating total tasks:', { row, error: err });
          return sum;
        }
      },
      0
    );

    return {
      distribution,
      summary: {
        totalTasks,
        byPriority: Object.entries(distribution).map(([priority, statuses]) => ({
          priority,
          total: Object.values(statuses).reduce((sum, count) => sum + count, 0),
          byStatus: statuses,
        })),
      },
    };
  }

  /**
   * Get backlog of high-priority (HIGH/URGENT) tasks
   */
  async getHighPriorityBacklog(
    user: UserContext,
    transaction?: Transaction
  ) {
    const whereClause: any = {
      priority: {
        [Op.in]: [TaskPriority.HIGH, TaskPriority.URGENT],
      },
      status: {
        [Op.ne]: TaskStatus.COMPLETED,
      },
    };

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
            Task.sequelize!.col('Task.created_at'),
            Task.sequelize!.fn('NOW')
          ),
          'ageInDays',
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
        ['priority', 'DESC'],
        [Task.sequelize!.col('Task.created_at'), 'ASC'],
      ],
      raw: false,
    });

    return result.map((row: any) => {
      try {
        return {
      taskId: row.id,
      taskName: row.name,
      priority: row.priority,
      status: row.status,
          ageInDays: parseInt(String(row.getDataValue?.('ageInDays') || row.ageInDays || '0'), 10),
      dueDate: row.dueDate,
      assignedTo: row.assignedTo
        ? {
            id: row.assignedTo.id,
            email: row.assignedTo.email,
                name: `${row.assignedTo.firstName || ''} ${row.assignedTo.lastName || ''}`.trim(),
          }
        : null,
      study: {
            id: row.study?.id,
            name: row.study?.name,
      },
      project: {
            id: row.study?.project?.id,
            name: row.study?.project?.name,
          },
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing backlog row:', { row, error: err });
        throw err;
      }
    });
  }

  /**
   * Get study progress distribution
   */
  async getStudyProgressDistribution(
    projectId: number | null,
    user: UserContext,
    transaction?: Transaction
  ) {
    let whereClause: any = projectId ? { projectId } : {};

    // For Managers: show all studies (even without tasks)
    // For Researchers: show only studies with assigned tasks
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
              WHEN Study.progress < 25 THEN '0-25'
              WHEN Study.progress < 50 THEN '25-50'
              WHEN Study.progress < 75 THEN '50-75'
              WHEN Study.progress < 100 THEN '75-100'
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

    return result.map((row: any) => {
      try {
        // Handle raw:true format - column names might be prefixed
        const progressRange = row.progressRange || row['progressRange'] || row['Study.progressRange'];
        const studyCount = parseInt(String(row.studyCount || row['studyCount'] || row['Study.studyCount'] || '0'), 10);
        return {
          progressRange: progressRange || '0-25',
          studyCount,
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing study progress row:', { row, error: err });
        throw err;
      }
    });
  }

  /**
   * Calculate compliance flag rate across tasks
   */
  async getComplianceFlagRate(
    projectId: number | null,
    studyId: number | null,
    user: UserContext,
    severity: string | null = null,
    transaction?: Transaction
  ) {
    try {
    const whereClause: any = {};

    if (studyId) {
      whereClause.studyId = studyId;
    }

    this.applyRbacFilter(whereClause, user);

    // Build includes array
    const includes: any[] = [
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
      ];

    // Build attributes array
    // Use conditional counting to properly count tasks with flags
    const attributes: any[] = [
      [
        Task.sequelize!.fn('COUNT', Task.sequelize!.fn('DISTINCT', Task.sequelize!.col('Task.id'))),
        'totalTasks',
      ],
        [
          Task.sequelize!.fn(
            'COUNT',
          Task.sequelize!.fn(
            'DISTINCT',
            Task.sequelize!.literal(
              `CASE WHEN complianceFlags.id IS NOT NULL THEN Task.id ELSE NULL END`
            )
          )
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
    ];

    const result = await Task.findAll({
      transaction,
      attributes,
      where: whereClause,
      include: includes,
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
      // Handle raw:true format - column names might be prefixed
      const totalTasks = parseInt(String(row.totalTasks || row['totalTasks'] || '0'), 10);
      const tasksWithFlags = parseInt(String(row.tasksWithFlags || row['tasksWithFlags'] || '0'), 10);
      const totalOpenFlags = parseInt(String(row.totalOpenFlags || row['totalOpenFlags'] || '0'), 10);
    const flagRate = totalTasks > 0 ? (tasksWithFlags / totalTasks) * 100 : 0;

    return {
      totalTasks,
      tasksWithFlags,
      totalOpenFlags,
      flagRate: Math.round(flagRate * 100) / 100,
      };
    } catch (error: any) {
      // Handle case where compliance_flags table doesn't exist yet
      if (error?.parent?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[AnalyticsService] compliance_flags table does not exist, returning default values');
        return {
          totalTasks: 0,
          tasksWithFlags: 0,
          totalOpenFlags: 0,
          flagRate: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Calculate average time to complete tasks for researchers
   * Uses TIMESTAMPDIFF for efficient date calculation in MariaDB
   */
  async getAverageCompletionTime(
    researcherId: number | null,
    startDate: Date,
    endDate: Date,
    user: UserContext,
    transaction?: Transaction
  ) {
    this.validateDateRange(startDate, endDate);

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

    this.applyRbacFilter(whereClause, user);

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
              Task.sequelize!.col('Task.created_at'),
              Task.sequelize!.col('Task.completed_at')
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
              Task.sequelize!.col('Task.created_at'),
              Task.sequelize!.col('Task.completed_at')
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
              Task.sequelize!.col('Task.created_at'),
              Task.sequelize!.col('Task.completed_at')
            )
          ),
          'maxHoursToComplete',
        ],
        [Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')), 'completedCount'],
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

    return result.map((row: any) => {
      try {
        return {
          researcherId: row.assignedToId,
          researcher: {
            id: row.assignedTo?.id,
            email: row.assignedTo?.email,
            name: `${row.assignedTo?.firstName || ''} ${row.assignedTo?.lastName || ''}`.trim(),
          },
          avgHoursToComplete: parseFloat(String(row.getDataValue?.('avgHoursToComplete') || row.avgHoursToComplete || '0')),
          minHoursToComplete: parseInt(String(row.getDataValue?.('minHoursToComplete') || row.minHoursToComplete || '0'), 10),
          maxHoursToComplete: parseInt(String(row.getDataValue?.('maxHoursToComplete') || row.maxHoursToComplete || '0'), 10),
          completedCount: parseInt(String(row.getDataValue?.('completedCount') || row.completedCount || '0'), 10),
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing completion time row:', { row, error: err });
        throw err;
      }
    });
  }

  /**
   * Calculate on-time completion rate for researchers
   * On-time = completedAt <= dueDate
   */
  async getOnTimeCompletionRate(
    researcherId: number | null,
    startDate: Date,
    endDate: Date,
    user: UserContext,
    transaction?: Transaction
  ) {
    this.validateDateRange(startDate, endDate);

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
      dueDate: { [Op.ne]: null },
    };

    this.applyRbacFilter(whereClause, user);

    const result = await Task.findAll({
      transaction,
      attributes: [
        'assignedToId',
        [Task.sequelize!.fn('COUNT', Task.sequelize!.col('Task.id')), 'totalWithDueDate'],
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

    return result.map((row: any) => {
      try {
        return {
          researcherId: row.assignedToId,
          researcher: {
            id: row.assignedTo?.id,
            email: row.assignedTo?.email,
            name: `${row.assignedTo?.firstName || ''} ${row.assignedTo?.lastName || ''}`.trim(),
          },
          totalWithDueDate: parseInt(String(row.getDataValue?.('totalWithDueDate') || row.totalWithDueDate || '0'), 10),
          onTimeCount: parseInt(String(row.getDataValue?.('onTimeCount') || row.onTimeCount || '0'), 10),
          onTimeRate: parseFloat(String(row.getDataValue?.('onTimeRate') || row.onTimeRate || '0')) * 100,
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing on-time row:', { row, error: err });
        throw err;
      }
    });
  }

  /**
   * Get project velocity - tasks completed per day/week/month
   */
  async getProjectVelocity(
    projectId: number | null,
    startDate: Date,
    endDate: Date,
    period: 'day' | 'week' | 'month',
    user: UserContext,
    transaction?: Transaction
  ) {
    this.validateDateRange(startDate, endDate);

    const dateFormatMap = {
      day: '%Y-%m-%d',
      week: '%Y-%u',
      month: '%Y-%m',
    };

    const dateFormat = dateFormatMap[period];

    const whereClause: any = {
      status: TaskStatus.COMPLETED,
      completedAt: {
        [Op.between]: [startDate, endDate],
      },
    };

    this.applyRbacFilter(whereClause, user);

    const result = await Task.findAll({
      transaction,
      attributes: [
        [
          Task.sequelize!.fn(
            'DATE_FORMAT',
            Task.sequelize!.col('Task.completed_at'),
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
        Task.sequelize!.literal('period'),
      ],
      order: [
        ['study', 'project', 'id', 'ASC'],
        [Task.sequelize!.literal('period'), 'ASC'],
      ],
      raw: false,
    });

    const velocityMap = new Map<number, Array<{ period: string; count: number }>>();

    result.forEach((row: any) => {
      try {
        const pid = row.study?.project?.id;
        const periodValue = row.getDataValue?.('period') || row.period;
        const count = parseInt(String(row.getDataValue?.('completedCount') || row.completedCount || '0'), 10);

        if (pid) {
          if (!velocityMap.has(pid)) {
            velocityMap.set(pid, []);
          }
          velocityMap.get(pid)!.push({ period: periodValue, count });
        }
      } catch (err) {
        console.error('[AnalyticsService] Error processing velocity row:', { row, error: err });
      }
    });

    return Array.from(velocityMap.entries()).map(([id, periods]) => ({
      projectId: id,
      projectName: result.find((r: any) => r.study.project.id === id)?.study.project.name || '',
      velocity: periods,
    }));
  }

  /**
   * Calculate project health score (0-100)
   * Factors: Progress (40%), Overdue tasks (30%), Compliance flags (30%)
   */
  async getProjectHealthScore(
    projectId: number | null,
    user: UserContext,
    transaction?: Transaction
  ) {
    try {
      let projectFilter = projectId ? 'p.id = :projectId' : '1=1';
      let taskFilter = '';
      const replacements: any = {
        projectId: projectId || null,
        openStatus: ComplianceFlagStatus.OPEN,
      };

      if (user.role === UserRole.RESEARCHER) {
        taskFilter = 'AND t.assigned_to_id = :userId';
        replacements.userId = user.id;
      }

      const projects = await Project.sequelize!.query(
      `
      SELECT 
        p.id,
        p.name,
        p.progress as cached_progress,
        LEAST(40, (p.progress * 0.4)) as progress_score,
        CASE 
          WHEN COUNT(DISTINCT t.id) = 0 THEN 30
          ELSE GREATEST(0, 30 - (
            (COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'completed' THEN 1 END) * 30.0) / 
            NULLIF(COUNT(DISTINCT t.id), 0)
          ))
        END as overdue_score,
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

      return (projects as any[]).map((row: any) => {
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
    } catch (error: any) {
      // Handle case where compliance_flags table doesn't exist yet
      if (error?.parent?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[AnalyticsService] compliance_flags table does not exist, returning empty array');
        return [];
      }
      throw error;
    }
  }

  /**
   * Forecast study completion based on task completion velocity
   */
  async getStudyCompletionForecast(
    studyId: number | null,
    user: UserContext,
    transaction?: Transaction
  ) {
    const whereClause: any = {
      status: TaskStatus.COMPLETED,
      completedAt: {
        [Op.gte]: Task.sequelize!.literal("DATE_SUB(NOW(), INTERVAL 30 DAY)"),
      },
    };

    if (studyId) {
      whereClause.studyId = studyId;
    }

    const velocityData = await Task.findAll({
      transaction,
      attributes: [
        'studyId',
        [
          Task.sequelize!.fn('COUNT', Task.sequelize!.col('id')),
          'completedInLast30Days',
        ],
        [
          Task.sequelize!.fn(
            'AVG',
            Task.sequelize!.fn(
              'TIMESTAMPDIFF',
              Task.sequelize!.literal('DAY'),
              Task.sequelize!.col('Task.created_at'),
              Task.sequelize!.col('Task.completed_at')
            )
          ),
          'avgDaysToComplete',
        ],
      ],
      where: whereClause,
      group: ['studyId'],
      raw: true,
    });

    const studyWhereClause: any = studyId ? { id: studyId } : {};

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
            WHERE t.study_id = Study.id
          )`),
          'totalTasks',
        ],
        [
          Task.sequelize!.literal(`(
            SELECT COUNT(t.id)
            FROM tasks t
            WHERE t.study_id = Study.id
            AND t.status = '${TaskStatus.COMPLETED}'
          )`),
          'completedTasks',
        ],
      ],
      where: studyWhereClause,
      raw: true,
    });

    return studies.map((study: any) => {
      try {
        const velocity = velocityData.find((v: any) => v.studyId === study.id || v['studyId'] === study.id);
        const totalTasks = parseInt(String(study.totalTasks || study['totalTasks'] || '0'), 10);
        const completedTasks = parseInt(String(study.completedTasks || study['completedTasks'] || '0'), 10);
        const remainingTasks = totalTasks - completedTasks;

        const tasksPerDay = velocity
          ? parseFloat(String(velocity.completedInLast30Days || velocity['completedInLast30Days'] || '0')) / 30
          : 0;

        const estimatedDaysToComplete =
          tasksPerDay > 0 ? Math.ceil(remainingTasks / tasksPerDay) : null;

        const forecastedCompletionDate = estimatedDaysToComplete
          ? new Date(Date.now() + estimatedDaysToComplete * 24 * 60 * 60 * 1000)
          : null;

        return {
          studyId: study.id,
          studyName: study.name,
          currentProgress: parseFloat(String(study.progress || '0')),
          totalTasks,
          completedTasks,
          remainingTasks,
          tasksPerDay: tasksPerDay.toFixed(2),
          estimatedDaysToComplete,
          forecastedCompletionDate,
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing forecast study:', { study, error: err });
        throw err;
      }
    });
  }

  /**
   * Get compliance flag trends over time
   */
  async getComplianceFlagTrends(
    projectId: number | null,
    studyId: number | null,
    startDate: Date,
    endDate: Date,
    period: 'day' | 'week' | 'month',
    user: UserContext,
    transaction?: Transaction
  ) {
    try {
      this.validateDateRange(startDate, endDate);

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
      };

    const includes: any[] = [
      {
        model: Task,
        as: 'task',
        attributes: [],
        required: true,
        where: studyId ? { studyId } : {},
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
        ],
      },
    ];

    if (user.role === UserRole.RESEARCHER) {
      includes[0].where = {
        ...includes[0].where,
        assignedToId: user.id,
      };
    }

    const result = await ComplianceFlag.findAll({
      transaction,
      attributes: [
        [
          ComplianceFlag.sequelize!.fn(
            'DATE_FORMAT',
            ComplianceFlag.sequelize!.col('ComplianceFlag.created_at'),
            dateFormat
          ),
          'period',
        ],
        [
          ComplianceFlag.sequelize!.fn(
            'COUNT',
            ComplianceFlag.sequelize!.col('ComplianceFlag.id')
          ),
          'flagCount',
        ],
      ],
      where: whereClause,
      include: includes,
      group: [ComplianceFlag.sequelize!.literal('period')],
      order: [[ComplianceFlag.sequelize!.literal('period'), 'ASC']],
      raw: true,
    });

      return result.map((row: any) => {
        try {
          return {
            period: row.period || row['period'] || '',
            flagCount: parseInt(String(row.flagCount || row['flagCount'] || '0'), 10),
          };
        } catch (err) {
          console.error('[AnalyticsService] Error processing compliance trends row:', { row, error: err });
          throw err;
        }
      });
    } catch (error: any) {
      // Handle case where compliance_flags table doesn't exist yet
      if (error?.parent?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[AnalyticsService] compliance_flags table does not exist, returning empty array');
        return [];
      }
      throw error;
    }
  }

  /**
   * Calculate average time to resolve compliance flags
   */
  async getAverageFlagResolutionTime(
    projectId: number | null,
    studyId: number | null,
    user: UserContext,
    transaction?: Transaction
  ) {
    try {
      const whereClause: any = {
      status: {
        [Op.in]: [ComplianceFlagStatus.RESOLVED, ComplianceFlagStatus.DISMISSED],
      },
      resolvedAt: { [Op.ne]: null },
    };

    const includes: any[] = [
      {
        model: Task,
        as: 'task',
        attributes: [],
        required: true,
        where: studyId ? { studyId } : {},
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
        ],
      },
    ];

    if (user.role === UserRole.RESEARCHER) {
      includes[0].where = {
        ...includes[0].where,
        assignedToId: user.id,
      };
    }

    const result = await ComplianceFlag.findAll({
      transaction,
      attributes: [
        [
          ComplianceFlag.sequelize!.fn(
            'AVG',
              ComplianceFlag.sequelize!.fn(
              'TIMESTAMPDIFF',
              ComplianceFlag.sequelize!.literal('HOUR'),
              ComplianceFlag.sequelize!.col('ComplianceFlag.created_at'),
              ComplianceFlag.sequelize!.col('ComplianceFlag.resolved_at')
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
              ComplianceFlag.sequelize!.col('ComplianceFlag.created_at'),
              ComplianceFlag.sequelize!.col('ComplianceFlag.resolved_at')
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
              ComplianceFlag.sequelize!.col('ComplianceFlag.created_at'),
              ComplianceFlag.sequelize!.col('ComplianceFlag.resolved_at')
            )
          ),
          'maxHoursToResolve',
        ],
        [
          ComplianceFlag.sequelize!.fn(
            'COUNT',
            ComplianceFlag.sequelize!.col('ComplianceFlag.id')
          ),
          'resolvedCount',
        ],
      ],
      where: whereClause,
      include: includes,
      group: [],
      raw: true,
    });

    if (result.length === 0) {
      return {
        avgHoursToResolve: 0,
        minHoursToResolve: 0,
        maxHoursToResolve: 0,
        resolvedCount: 0,
      };
    }

      const row = result[0];
      try {
        return {
          avgHoursToResolve: parseFloat(String(row.avgHoursToResolve || row['avgHoursToResolve'] || '0')),
          minHoursToResolve: parseInt(String(row.minHoursToResolve || row['minHoursToResolve'] || '0'), 10),
          maxHoursToResolve: parseInt(String(row.maxHoursToResolve || row['maxHoursToResolve'] || '0'), 10),
          resolvedCount: parseInt(String(row.resolvedCount || row['resolvedCount'] || '0'), 10),
        };
      } catch (err) {
        console.error('[AnalyticsService] Error processing compliance resolution:', { row, error: err });
        throw err;
      }
    } catch (error: any) {
      // Handle case where compliance_flags table doesn't exist yet
      if (error?.parent?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[AnalyticsService] compliance_flags table does not exist, returning default values');
        return {
          avgHoursToResolve: 0,
          minHoursToResolve: 0,
          maxHoursToResolve: 0,
          resolvedCount: 0,
        };
      }
      throw error;
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
