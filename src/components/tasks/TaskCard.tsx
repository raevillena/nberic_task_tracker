// Task Card Component for Mobile View

'use client';

import Link from 'next/link';
import { Task, TaskStatus, TaskPriority, TaskType } from '@/types/entities';

interface TaskCardProps {
  task: Task & { isRead?: boolean };
  getAssignedDate: (task: Task) => Date | string | null;
  formatDate: (date: Date | string | null) => string;
  getStatusColor: (status: TaskStatus) => string;
  getPriorityColor: (priority: TaskPriority) => string;
}

export function TaskCard({
  task,
  getAssignedDate,
  formatDate,
  getStatusColor,
  getPriorityColor,
}: TaskCardProps) {
  const taskPath =
    task.taskType === TaskType.ADMIN && task.projectId
      ? `/dashboard/projects/${task.projectId}/tasks/${task.id}`
      : task.taskType === TaskType.ADMIN
      ? `/dashboard/tasks/${task.id}`
      : task.studyId && (task as any).study?.project?.id
      ? `/dashboard/projects/${(task as any).study.project.id}/studies/${task.studyId}/tasks/${task.id}`
      : `/dashboard/tasks/${task.id}`;

  return (
    <Link
      href={taskPath}
      onClick={() => {
        sessionStorage.setItem(`referrer:${taskPath}`, '/dashboard/tasks');
      }}
      className="block bg-white rounded-lg shadow-md p-4 sm:p-5 hover:shadow-lg transition-shadow border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {!(task as any).isRead && (
              <div className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0" title="Unread" />
            )}
            <h3
              className={`text-base sm:text-lg font-semibold truncate ${
                !(task as any).isRead ? 'text-indigo-700' : 'text-gray-900'
              }`}
            >
              {task.name}
            </h3>
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">{task.description}</p>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ml-2 ${
            task.taskType === TaskType.ADMIN
              ? 'bg-purple-100 text-purple-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {task.taskType === TaskType.ADMIN ? 'Admin' : 'Research'}
        </span>
      </div>

      {/* Project/Study Info */}
      <div className="mb-3 pb-3 border-b border-gray-200">
        <div className="text-sm text-gray-900 font-medium">
          {task.study?.project?.name || (task as any).project?.name || (task.taskType === TaskType.ADMIN ? '' : 'Unassigned')}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {task.taskType === TaskType.ADMIN
            ? 'Admin Task'
            : (task as any).study?.name || 'Unknown Study'}
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Assigned To</p>
          <p className="text-sm text-gray-900 font-medium">
            {task.assignedTo
              ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
              : (task as any).assignedResearchers && (task as any).assignedResearchers.length > 0
              ? `${(task as any).assignedResearchers.length} researcher${(task as any).assignedResearchers.length > 1 ? 's' : ''}`
              : 'Unassigned'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Assigned Date</p>
          <p className="text-sm text-gray-900">{formatDate(getAssignedDate(task))}</p>
        </div>
      </div>

      {/* Status and Priority */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(task.priority)}`}
        >
          {task.priority}
        </span>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}
        >
          {task.status.replace('_', ' ')}
        </span>
      </div>

      {/* Due Date */}
      {task.dueDate && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Due Date</span>
            <span className="text-sm font-medium text-gray-900">{formatDate(task.dueDate)}</span>
          </div>
        </div>
      )}
    </Link>
  );
}
