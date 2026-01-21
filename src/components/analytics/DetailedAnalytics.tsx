// Detailed Analytics - Lazy loaded component

'use client';

import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';

interface AnalyticsData {
  productivity: any[];
  workload: any[];
  projects: any[];
  priority: any;
  studies: any[];
  compliance: any;
  completionTime: any[];
  onTimeRate: any[];
  velocity: any[];
  health: any[];
  forecast: any[];
  complianceTrends: any[];
  complianceResolution: any;
}

interface DetailedAnalyticsProps {
  analytics: AnalyticsData;
  userRole?: UserRole;
}

export default function DetailedAnalytics({ analytics, userRole }: DetailedAnalyticsProps) {
  // For researchers, hide manager-specific analytics sections
  const isManager = userRole === UserRole.MANAGER;
  return (
    <>
      {/* Researcher Productivity Summary - Managers only */}
      {isManager && analytics.productivity.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Researcher Performance</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Researcher
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
                  {analytics.productivity.map((item) => (
                    <tr key={item.researcherId}>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{item.researcher.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[150px] sm:max-w-none">
                          {item.researcher.email}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalTasks}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.completedTasks}</td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-center min-w-0">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2 flex-shrink-0">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${item.completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                            {item.completionRate.toFixed(1)}%
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

      {/* Current Workload - Managers only */}
      {isManager && analytics.workload.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Current Workload Distribution</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {analytics.workload.map((item) => (
              <div key={item.researcherId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-2">{item.researcher.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Active Tasks:</span>
                    <span className="font-medium text-gray-900">{item.activeTaskCount}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-medium text-gray-900">{item.pendingCount}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">In Progress:</span>
                    <span className="font-medium text-gray-900">{item.inProgressCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Progress - Managers only */}
      {isManager && analytics.projects.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Project Progress Overview</h2>
          <div className="space-y-3 sm:space-y-4">
            {analytics.projects.map((project) => (
              <div key={project.projectId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{project.projectName}</h3>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                    {project.calculatedProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      project.calculatedProgress === 100
                        ? 'bg-green-600'
                        : project.calculatedProgress > 0
                        ? 'bg-indigo-600'
                        : 'bg-gray-300'
                    }`}
                    style={{ width: `${project.calculatedProgress}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Studies:</span> {project.studyCount}
                  </div>
                  <div>
                    <span className="font-medium">Total Tasks:</span> {project.totalTasks}
                  </div>
                  <div>
                    <span className="font-medium">Completed:</span> {project.completedTasks}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Priority Distribution - Managers only */}
      {isManager && analytics.priority && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Task Priority Distribution</h2>
          <div className="mb-3 sm:mb-4">
            <p className="text-xs sm:text-sm text-gray-600 mb-2">Total Tasks: {analytics.priority.summary.totalTasks}</p>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pending
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      In Progress
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cancelled
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.priority.summary.byPriority.map((item: any) => (
                    <tr key={item.priority}>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            item.priority === TaskPriority.URGENT
                              ? 'bg-red-100 text-red-800'
                              : item.priority === TaskPriority.HIGH
                              ? 'bg-orange-100 text-orange-800'
                              : item.priority === TaskPriority.MEDIUM
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{item.total}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.byStatus[TaskStatus.PENDING] || 0}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.byStatus[TaskStatus.IN_PROGRESS] || 0}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.byStatus[TaskStatus.COMPLETED] || 0}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.byStatus[TaskStatus.CANCELLED] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Study Progress Distribution - Managers only */}
      {isManager && analytics.studies.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Study Progress Distribution</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            {analytics.studies.map((item: any) => (
              <div key={item.progressRange} className="border border-gray-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="text-xl sm:text-2xl font-bold text-indigo-600 mb-1">{item.studyCount}</div>
                <div className="text-xs sm:text-sm text-gray-600">{item.progressRange}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average Completion Time - Managers only */}
      {isManager && analytics.completionTime.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Average Task Completion Time</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Researcher
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Hours
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Min Hours
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Max Hours
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed Tasks
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.completionTime.map((item: any) => (
                    <tr key={item.researcherId}>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">{item.researcher.name}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.avgHoursToComplete.toFixed(1)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.minHoursToComplete}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.maxHoursToComplete}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.completedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* On-Time Completion Rate - Managers only */}
      {isManager && analytics.onTimeRate.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">On-Time Completion Rate</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Researcher
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total with Due Date
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      On-Time Count
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      On-Time Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.onTimeRate.map((item: any) => (
                    <tr key={item.researcherId}>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">{item.researcher.name}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.totalWithDueDate}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.onTimeCount}
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-center min-w-0">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2 flex-shrink-0">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${item.onTimeRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                            {item.onTimeRate.toFixed(1)}%
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

      {/* Project Velocity - Managers only */}
      {isManager && analytics.velocity.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Project Velocity (Tasks Completed Per Day)</h2>
          <div className="space-y-3 sm:space-y-4">
            {analytics.velocity.map((project: any) => (
              <div key={project.projectId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-2 sm:mb-3">{project.projectName}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                  {project.velocity.slice(-10).map((period: any) => (
                    <div key={period.period} className="text-center">
                      <div className="text-xs text-gray-500 mb-1 truncate">{period.period}</div>
                      <div className="text-base sm:text-lg font-bold text-indigo-600">{period.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Health Scores */}
      {analytics.health.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Project Health Scores</h2>
          <div className="space-y-3 sm:space-y-4">
            {analytics.health.map((project: any) => (
              <div key={project.projectId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{project.projectName}</h3>
                  <div className="flex items-center">
                    <div
                      className={`text-xl sm:text-2xl font-bold ${
                        project.healthScore >= 80
                          ? 'text-green-600'
                          : project.healthScore >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {project.healthScore}
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500 ml-2">/ 100</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-500">Progress Score</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-900">{project.breakdown.progressScore} / 40</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Overdue Score</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-900">{project.breakdown.overdueScore} / 30</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Compliance Score</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-900">{project.breakdown.complianceScore} / 30</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Studies:</span> {project.metrics.studyCount}
                  </div>
                  <div>
                    <span className="font-medium">Total Tasks:</span> {project.metrics.totalTasks}
                  </div>
                  <div>
                    <span className="font-medium">Overdue:</span> {project.metrics.overdueTasks}
                  </div>
                  <div>
                    <span className="font-medium">Open Flags:</span> {project.metrics.openComplianceFlags}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Study Completion Forecast - Managers only */}
      {isManager && analytics.forecast.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Study Completion Forecast</h2>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Study
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining Tasks
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tasks/Day
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Est. Days
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Forecasted Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.forecast.map((study: any) => (
                    <tr key={study.studyId}>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 break-words">{study.studyName}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-center min-w-0">
                          <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-2 mr-2 flex-shrink-0">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                study.currentProgress === 100
                                  ? 'bg-green-600'
                                  : study.currentProgress > 0
                                  ? 'bg-indigo-600'
                                  : 'bg-gray-300'
                              }`}
                              style={{ width: `${study.currentProgress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs sm:text-sm text-gray-900 whitespace-nowrap">
                            {study.currentProgress.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {study.remainingTasks} / {study.totalTasks}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {study.tasksPerDay}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {study.estimatedDaysToComplete !== null
                          ? `${study.estimatedDaysToComplete} days`
                          : 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900">
                        {study.forecastedCompletionDate
                          ? new Date(study.forecastedCompletionDate).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Flag Trends */}
      {analytics.complianceTrends.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Compliance Flag Trends</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {analytics.complianceTrends.slice(-10).map((trend: any) => (
              <div key={trend.period} className="text-center border border-gray-200 rounded-lg p-2 sm:p-3">
                <div className="text-xs text-gray-500 mb-1 truncate">{trend.period}</div>
                <div className="text-base sm:text-lg font-bold text-red-600">{trend.flagCount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Resolution Time */}
      {analytics.complianceResolution && analytics.complianceResolution.resolvedCount > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Compliance Flag Resolution Time</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Avg Hours to Resolve</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {analytics.complianceResolution.avgHoursToResolve.toFixed(1)}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Min Hours</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {analytics.complianceResolution.minHoursToResolve}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Max Hours</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600">
                {analytics.complianceResolution.maxHoursToResolve}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Resolved Flags</div>
              <div className="text-xl sm:text-2xl font-bold text-indigo-600">
                {analytics.complianceResolution.resolvedCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Metrics */}
      {analytics.compliance && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Compliance Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Tasks</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{analytics.compliance.totalTasks}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Tasks with Flags</div>
              <div className="text-xl sm:text-2xl font-bold text-orange-600">{analytics.compliance.tasksWithFlags}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Open Flags</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600">{analytics.compliance.totalOpenFlags}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Flag Rate</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">{analytics.compliance.flagRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
