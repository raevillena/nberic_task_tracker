// Admin Task Metrics Component

'use client';

import { TaskStatus, TaskPriority } from '@/types/entities';
import {
  AdminTaskMetrics,
  AdminTaskCompletionTrend,
  AdminTaskAssignmentMetrics,
  OverdueAdminTask,
} from '@/store/slices/analyticsSlice';

interface AdminTaskMetricsProps {
  metrics: AdminTaskMetrics | null;
  completionTrends: AdminTaskCompletionTrend[];
  assignments: AdminTaskAssignmentMetrics[];
  overdueTasks: OverdueAdminTask[];
}

export default function AdminTaskMetricsComponent({
  metrics,
  completionTrends,
  assignments,
  overdueTasks,
}: AdminTaskMetricsProps) {
  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full">
      {/* Admin Task Summary Cards */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-6">
        <h2 className="text-base sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Admin Tasks Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 rounded-lg p-2 sm:p-4 min-w-0">
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 break-words">Total Admin Tasks</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{metrics.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 sm:p-4 min-w-0">
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 break-words">Completed</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{metrics.completed}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1 line-clamp-1">
              {metrics.completionRate.toFixed(1)}% completion
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2 sm:p-4 min-w-0">
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 break-words">In Progress</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
              {metrics.byStatus[TaskStatus.IN_PROGRESS] || 0}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-2 sm:p-4 min-w-0">
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 break-words">Overdue</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{overdueTasks.length}</p>
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">Status Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {Object.entries(metrics.byStatus).map(([status, count]) => (
            <div key={status} className="text-center min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-[10px] sm:text-xs text-gray-600 capitalize break-words leading-tight">{status.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">Priority Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {Object.entries(metrics.byPriority).map(([priority, count]) => (
            <div key={priority} className="text-center min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-[10px] sm:text-xs text-gray-600 capitalize break-words leading-tight">{priority}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Assignment Metrics */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">Assignment Metrics</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Tasks
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completion Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignments.map((assignment, index) => (
                    <tr key={assignment.userId || `unassigned-${index}`}>
                      <td className="px-3 sm:px-6 py-4">
                        {assignment.user ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.user.name}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[150px] sm:max-w-none">
                              {assignment.user.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assignment.totalTasks}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assignment.completedTasks}
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-center min-w-0">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2 flex-shrink-0">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${assignment.completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                            {assignment.completionRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">Overdue Admin Tasks</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Overdue
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overdueTasks.map((task) => (
                    <tr key={task.taskId}>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 break-words">{task.taskName}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            task.priority === TaskPriority.URGENT
                              ? 'bg-red-100 text-red-800'
                              : task.priority === TaskPriority.HIGH
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        {task.assignedTo ? (
                          <div>
                            <div className="text-sm text-gray-900">{task.assignedTo.name}</div>
                            <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">
                              {task.assignedTo.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-red-600">
                          {task.daysOverdue} days
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        {task.project ? (
                          <span className="text-sm text-gray-900">{task.project.name}</span>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Completion Trends Chart */}
      {completionTrends.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900">Completion Trends</h3>
          <div className="space-y-2">
            {completionTrends.slice(-10).map((trend, index) => (
              <div key={index} className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-gray-600 flex-shrink-0 min-w-[80px] sm:min-w-[100px]">
                  {trend.period}
                </span>
                <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-0">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: `${
                          trend.total > 0 ? (trend.completed / trend.total) * 100 : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-900 whitespace-nowrap flex-shrink-0">
                    {trend.completed}/{trend.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
