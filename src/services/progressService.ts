// Progress service - Business logic for progress calculation

import { Transaction } from 'sequelize';
import { sequelize } from '@/lib/db/connection';
import { Task, Study, Project } from '@/lib/db/models';
import { TaskStatus, TaskType } from '@/types/entities';
import { DatabaseError } from '@/lib/utils/errors';

/**
 * Service layer for Progress calculation
 * Handles progress recalculation using Sequelize transactions for consistency
 */
export class ProgressService {
  /**
   * Calculate study progress based on completed tasks
   * Progress = (Completed Tasks / Total Tasks) × 100
   */
  async calculateStudyProgress(
    studyId: number,
    transaction?: Transaction
  ): Promise<number> {
    // Verify study exists
    const study = await Study.findByPk(studyId, { transaction });
    if (!study) {
      throw new DatabaseError(`Study with ID ${studyId} not found`);
    }

    // Count total tasks and completed tasks (only research tasks contribute to progress)
    const totalTasks = await Task.count({
      where: { 
        studyId,
        taskType: TaskType.RESEARCH, // Only research tasks count toward progress
      },
      transaction,
    });

    if (totalTasks === 0) {
      // No tasks means 0% progress
      study.progress = 0;
      await study.save({ transaction });
      return 0;
    }

    const completedTasks = await Task.count({
      where: {
        studyId,
        taskType: TaskType.RESEARCH, // Only research tasks count toward progress
        status: TaskStatus.COMPLETED,
      },
      transaction,
    });

    // Calculate percentage (0-100)
    const progress = Math.round((completedTasks / totalTasks) * 100 * 100) / 100; // Round to 2 decimal places

    // Update study progress
    study.progress = progress;
    await study.save({ transaction });

    return progress;
  }

  /**
   * Calculate project progress based on study progress
   * Progress = Average of all Study Progress values
   */
  async calculateProjectProgress(
    projectId: number,
    transaction?: Transaction
  ): Promise<number> {
    // Verify project exists
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw new DatabaseError(`Project with ID ${projectId} not found`);
    }

    // Get all studies for the project
    const studies = await Study.findAll({
      where: { projectId },
      attributes: ['progress'],
      transaction,
    });

    if (studies.length === 0) {
      // No studies means 0% progress
      project.progress = 0;
      await project.save({ transaction });
      return 0;
    }

    // Calculate average progress
    const totalProgress = studies.reduce(
      (sum, study) => sum + Number(study.progress),
      0
    );
    const averageProgress =
      Math.round((totalProgress / studies.length) * 100) / 100; // Round to 2 decimal places

    // Update project progress
    project.progress = averageProgress;
    await project.save({ transaction });

    return averageProgress;
  }

  /**
   * Update progress chain: Task → Study → Project
   * This method uses a transaction to ensure all progress updates are atomic
   * 
   * @param studyId - The study ID to recalculate progress for
   * @param existingTransaction - Optional existing transaction to use
   * @returns Object with updated progress values
   */
  async updateProgressChain(
    studyId: number,
    existingTransaction?: Transaction
  ): Promise<{
    studyProgress: number;
    projectProgress: number;
    projectId: number;
  }> {
    // Use existing transaction or create a new one
    // This allows the method to be called within other transactions
    const shouldCommit = !existingTransaction;
    const transaction = existingTransaction || await sequelize.transaction();

    try {
      // Get study to find project ID
      const study = await Study.findByPk(studyId, {
        attributes: ['id', 'projectId'],
        transaction,
      });

      if (!study) {
        throw new DatabaseError(`Study with ID ${studyId} not found`);
      }

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

      // Commit transaction if we created it
      if (shouldCommit) {
        await transaction.commit();
      }

      return {
        studyProgress,
        projectProgress,
        projectId: study.projectId,
      };
    } catch (error) {
      // Rollback transaction if we created it
      if (shouldCommit) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * Recalculate progress for a specific project and all its studies
   * Useful for bulk operations or data corrections
   */
  async recalculateProjectProgress(
    projectId: number,
    transaction?: Transaction
  ): Promise<number> {
    // Verify project exists
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw new DatabaseError(`Project with ID ${projectId} not found`);
    }

    // Get all studies for the project
    const studies = await Study.findAll({
      where: { projectId },
      attributes: ['id'],
      transaction,
    });

    // Recalculate progress for each study
    for (const study of studies) {
      await this.calculateStudyProgress(study.id, transaction);
    }

    // Recalculate project progress
    return await this.calculateProjectProgress(projectId, transaction);
  }
}

// Export singleton instance
export const progressService = new ProgressService();
