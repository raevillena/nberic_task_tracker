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
    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-red-900">High Priority Backlog</h2>
          <p className="text-sm text-red-700 mt-1">
            {backlog.length} {backlog.length === 1 ? 'task' : 'tasks'} require immediate attention
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-red-200">
          <thead className="bg-red-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Task
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Age (Days)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Assigned To
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-red-200">
            {backlog.slice(0, 5).map((item) => (
              <tr key={item.taskId}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{item.taskName}</div>
                  <div className="text-xs text-gray-500">{item.project.name} / {item.study.name}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
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
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.ageInDays} days</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {item.assignedTo ? item.assignedTo.name : 'Unassigned'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {backlog.length > 5 && (
        <p className="text-sm text-red-700 mt-3">
          + {backlog.length - 5} more {backlog.length - 5 === 1 ? 'task' : 'tasks'}
        </p>
      )}
    </div>
  );
}
