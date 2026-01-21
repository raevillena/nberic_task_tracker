// High Priority Backlog Component

'use client';

import { TaskPriority } from '@/types/entities';

interface BacklogItem {
  taskId: number;
  taskName: string;
  priority: TaskPriority;
  ageInDays: number;
  assignedTo: { name: string } | null;
  project: { name: string };
  study: { name: string };
}

interface HighPriorityBacklogProps {
  backlog: BacklogItem[];
}

export default function HighPriorityBacklog({ backlog }: HighPriorityBacklogProps) {
  if (backlog.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-red-900">High Priority Backlog</h2>
          <p className="text-xs sm:text-sm text-red-700 mt-1">
            {backlog.length} {backlog.length === 1 ? 'task' : 'tasks'} require immediate attention
          </p>
        </div>
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full divide-y divide-red-200">
            <thead className="bg-red-100">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                  Task
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                  Age (Days)
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                  Assigned To
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-red-200">
              {backlog.slice(0, 5).map((item) => (
                <tr key={item.taskId}>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 break-words">{item.taskName}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {item.project.name} / {item.study.name}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        item.priority === TaskPriority.URGENT
                          ? 'bg-red-200 text-red-900'
                          : 'bg-orange-200 text-orange-900'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.ageInDays} days</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">
                    <span className="truncate block max-w-[120px] sm:max-w-none">
                      {item.assignedTo ? item.assignedTo.name : 'Unassigned'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {backlog.length > 5 && (
        <p className="text-xs sm:text-sm text-red-700 mt-3">
          + {backlog.length - 5} more {backlog.length - 5 === 1 ? 'task' : 'tasks'}
        </p>
      )}
    </div>
  );
}
