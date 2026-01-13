// Analytics Summary Cards - Critical metrics loaded first

'use client';

import { TaskStatus, TaskPriority } from '@/types/entities';

interface AnalyticsData {
  projects: any[];
  priority: any;
  backlog: any[];
  workload: any[];
  productivity: any[];
  onTimeRate: any[];
}

interface AnalyticsSummaryCardsProps {
  analytics: AnalyticsData;
}

export default function AnalyticsSummaryCards({ analytics }: AnalyticsSummaryCardsProps) {
  // Calculate summary metrics
  const totalProjects = analytics.projects.length;
  const totalTasks = analytics.priority?.summary.totalTasks || 0;
  const completedTasks = analytics.priority?.summary.byPriority.reduce(
    (sum: number, p: any) => sum + (p.byStatus[TaskStatus.COMPLETED] || 0),
    0
  ) || 0;
  const activeTasks = analytics.workload.reduce((sum: number, w: any) => sum + w.activeTaskCount, 0);
  const highPriorityBacklog = analytics.backlog.length;
  const avgCompletionRate = analytics.productivity.length > 0
    ? analytics.productivity.reduce((sum: number, p: any) => sum + p.completionRate, 0) / analytics.productivity.length
    : 0;
  const avgOnTimeRate = analytics.onTimeRate.length > 0
    ? analytics.onTimeRate.reduce((sum: number, o: any) => sum + o.onTimeRate, 0) / analytics.onTimeRate.length
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Projects</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalProjects}</p>
          </div>
          <div className="bg-indigo-100 rounded-full p-3">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Tasks</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalTasks}</p>
            <p className="text-xs text-gray-500 mt-1">{completedTasks} completed</p>
          </div>
          <div className="bg-green-100 rounded-full p-3">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Tasks</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{activeTasks}</p>
            {highPriorityBacklog > 0 && (
              <p className="text-xs text-red-600 mt-1">{highPriorityBacklog} high priority</p>
            )}
          </div>
          <div className="bg-yellow-100 rounded-full p-3">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg Completion Rate</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{avgCompletionRate.toFixed(1)}%</p>
            {avgOnTimeRate > 0 && (
              <p className="text-xs text-gray-500 mt-1">{avgOnTimeRate.toFixed(1)}% on-time</p>
            )}
          </div>
          <div className="bg-blue-100 rounded-full p-3">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
