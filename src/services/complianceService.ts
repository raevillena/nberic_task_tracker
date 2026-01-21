// Compliance service - Business logic for compliance flag operations

import { Transaction } from 'sequelize';
import { ComplianceFlag, Task, User } from '@/lib/db/models';
import { ComplianceFlagStatus, ComplianceFlagSeverity } from '@/lib/db/models/complianceFlag';
import { UserRole } from '@/types/entities';
import { UserContext } from '@/types/rbac';
import {
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@/lib/utils/errors';

/**
 * Service layer for Compliance Flag operations
 * Handles non-compliance tracking and resolution
 */
export class ComplianceService {
  /**
   * Create a compliance flag for a task
   * Managers can raise flags, Researchers can raise flags for their assigned tasks
   */
  async createComplianceFlag(
    taskId: number,
    data: {
      flagType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    },
    user: UserContext,
    transaction?: Transaction
  ) {
    // Verify task exists and load assignedResearchers if needed
    const task = await Task.findByPk(taskId, {
      include: [
        {
          model: User,
          as: 'assignedResearchers',
          attributes: ['id'],
          required: false,
        },
      ],
      transaction,
    });
    if (!task) {
      throw new NotFoundError(`Task with ID ${taskId} not found`);
    }

    // Researchers can only flag their assigned tasks
    // Check both legacy assignedToId and many-to-many assignedResearchers
    if (user.role === UserRole.RESEARCHER) {
      const isAssigned = 
        task.assignedToId === user.id ||
        (task.assignedResearchers && 
         Array.isArray(task.assignedResearchers) && 
         task.assignedResearchers.some((r: any) => r.id === user.id));
      
      if (!isAssigned) {
        throw new PermissionError(
          'You can only raise compliance flags for tasks assigned to you'
        );
      }
    }

    if (!data.flagType || data.flagType.trim().length === 0) {
      throw new ValidationError('Flag type is required');
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError('Description is required');
    }

    return await ComplianceFlag.create(
      {
        taskId,
        flagType: data.flagType.trim(),
        severity: data.severity as any,
        status: ComplianceFlagStatus.OPEN,
        description: data.description.trim(),
        raisedById: user.id,
      },
      { transaction }
    );
  }

  /**
   * Get all compliance flags for a task
   * Managers see all flags, Researchers see flags for their assigned tasks
   */
  async getComplianceFlagsByTask(
    taskId: number,
    user: UserContext,
    transaction?: Transaction
  ) {
    // Verify task exists and user has access
    // Load assignedResearchers to check assignment for researchers
    const task = await Task.findByPk(taskId, {
      include: [
        {
          model: User,
          as: 'assignedResearchers',
          attributes: ['id'],
          required: false,
        },
      ],
      transaction,
    });
    if (!task) {
      throw new NotFoundError(`Task with ID ${taskId} not found`);
    }

    // Researchers can only see flags for their assigned tasks
    // Check both legacy assignedToId and many-to-many assignedResearchers
    if (user.role === UserRole.RESEARCHER) {
      const isAssigned = 
        task.assignedToId === user.id ||
        (task.assignedResearchers && 
         Array.isArray(task.assignedResearchers) && 
         task.assignedResearchers.some((r: any) => r.id === user.id));
      
      if (!isAssigned) {
        throw new PermissionError(
          'You do not have access to compliance flags for this task'
        );
      }
    }

    return await ComplianceFlag.findAll({
      where: { taskId },
      include: [
        {
          model: User,
          as: 'raisedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        {
          model: User,
          as: 'resolvedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      transaction,
    });
  }

  /**
   * Get a single compliance flag by ID
   */
  async getComplianceFlagById(
    flagId: number,
    user: UserContext,
    transaction?: Transaction
  ) {
    const flag = await ComplianceFlag.findByPk(flagId, {
      include: [
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'assignedToId'],
          include: [
            {
              model: User,
              as: 'assignedResearchers',
              attributes: ['id'],
              required: false,
            },
          ],
        },
        {
          model: User,
          as: 'raisedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        {
          model: User,
          as: 'resolvedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
          required: false,
        },
      ],
      transaction,
    });

    if (!flag) {
      throw new NotFoundError(`Compliance flag with ID ${flagId} not found`);
    }

    // Researchers can only see flags for their assigned tasks
    // Type assertion needed because Sequelize relations aren't in the model type
    const flagData = flag as any;
    if (user.role === UserRole.RESEARCHER) {
      const task = flagData.task;
      if (!task) {
        throw new PermissionError(
          'You do not have access to this compliance flag'
        );
      }
      
      // Check both legacy assignedToId and many-to-many assignedResearchers
      const isAssigned = 
        task.assignedToId === user.id ||
        (task.assignedResearchers && 
         Array.isArray(task.assignedResearchers) && 
         task.assignedResearchers.some((r: any) => r.id === user.id));
      
      if (!isAssigned) {
        throw new PermissionError(
          'You do not have access to this compliance flag'
        );
      }
    }

    return flag;
  }

  /**
   * Resolve a compliance flag
   * Only Managers can resolve flags
   */
  async resolveComplianceFlag(
    flagId: number,
    data: { notes?: string },
    user: UserContext,
    transaction?: Transaction
  ) {
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only Managers can resolve compliance flags');
    }

    const flag = await this.getComplianceFlagById(flagId, user, transaction);

    if (flag.status === ComplianceFlagStatus.RESOLVED) {
      throw new ValidationError('Compliance flag is already resolved');
    }

    flag.status = ComplianceFlagStatus.RESOLVED;
    flag.resolvedById = user.id;
    flag.resolvedAt = new Date();
    flag.notes = data.notes?.trim() || null;

    await flag.save({ transaction });
    return flag;
  }

  /**
   * Dismiss a compliance flag
   * Only Managers can dismiss flags
   */
  async dismissComplianceFlag(
    flagId: number,
    data: { notes?: string },
    user: UserContext,
    transaction?: Transaction
  ) {
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only Managers can dismiss compliance flags');
    }

    const flag = await this.getComplianceFlagById(flagId, user, transaction);

    if (flag.status === ComplianceFlagStatus.DISMISSED) {
      throw new ValidationError('Compliance flag is already dismissed');
    }

    flag.status = ComplianceFlagStatus.DISMISSED;
    flag.resolvedById = user.id;
    flag.resolvedAt = new Date();
    flag.notes = data.notes?.trim() || null;

    await flag.save({ transaction });
    return flag;
  }

  /**
   * Get all open compliance flags for a task
   * Useful for checking if a task has unresolved compliance issues
   */
  async getOpenComplianceFlagsByTask(
    taskId: number,
    user: UserContext,
    transaction?: Transaction
  ) {
    // Verify task exists and user has access
    // Load assignedResearchers to check assignment for researchers
    const task = await Task.findByPk(taskId, {
      include: [
        {
          model: User,
          as: 'assignedResearchers',
          attributes: ['id'],
          required: false,
        },
      ],
      transaction,
    });
    if (!task) {
      throw new NotFoundError(`Task with ID ${taskId} not found`);
    }

    // Researchers can only see flags for their assigned tasks
    // Check both legacy assignedToId and many-to-many assignedResearchers
    if (user.role === UserRole.RESEARCHER) {
      const isAssigned = 
        task.assignedToId === user.id ||
        (task.assignedResearchers && 
         Array.isArray(task.assignedResearchers) && 
         task.assignedResearchers.some((r: any) => r.id === user.id));
      
      if (!isAssigned) {
        throw new PermissionError(
          'You do not have access to compliance flags for this task'
        );
      }
    }

    return await ComplianceFlag.findAll({
      where: {
        taskId,
        status: ComplianceFlagStatus.OPEN,
      },
      include: [
        {
          model: User,
          as: 'raisedBy',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['severity', 'DESC'], ['createdAt', 'DESC']],
      transaction,
    });
  }
}

// Export singleton instance
export const complianceService = new ComplianceService();

