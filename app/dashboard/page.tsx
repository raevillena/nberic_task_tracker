// Analytics Dashboard - Home page

'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { apiRequest } from '@/lib/utils/api';
import {
  ResearcherProductivityResponse,
  ResearcherWorkloadResponse,
  ProjectProgressResponse,
  TaskPriorityDistributionResponse,
  HighPriorityBacklogResponse,
  StudyProgressDistributionResponse,
  ComplianceFlagRateResponse,
  AverageCompletionTimeResponse,
  OnTimeCompletionRateResponse,
  ProjectVelocityResponse,
  ProjectHealthScoreResponse,
  StudyCompletionForecastResponse,
  ComplianceFlagTrendsResponse,
  ComplianceFlagResolutionTimeResponse,
} from '@/types/api';
import { TaskPriority, TaskStatus } from '@/types/entities';

interface AnalyticsData {
  productivity: ResearcherProductivityResponse[];
  workload: ResearcherWorkloadResponse[];
  projects: ProjectProgressResponse[];
  priority: TaskPriorityDistributionResponse | null;
  backlog: HighPriorityBacklogResponse[];
  studies: StudyProgressDistributionResponse[];
  compliance: ComplianceFlagRateResponse | null;
  completionTime: AverageCompletionTimeResponse[];
  onTimeRate: OnTimeCompletionRateResponse[];
  velocity: ProjectVelocityResponse[];
  health: ProjectHealthScoreResponse[];
  forecast: StudyCompletionForecastResponse[];
  complianceTrends: ComplianceFlagTrendsResponse[];
  complianceResolution: ComplianceFlagResolutionTimeResponse | null;
}

export default function AnalyticsDashboard() {
  const { user } = useAppSelector((state) => state.auth);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);

        // Calculate date range (last 30 days) - but allow all time if needed
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // For productivity, use a wider range to catch more data
        const productivityStartDate = new Date();
        productivityStartDate.setDate(productivityStartDate.getDate() - 90); // Last 90 days

        // Fetch all analytics in parallel
        const [
          productivityRes,
          workloadRes,
          projectsRes,
          priorityRes,
          backlogRes,
          studiesRes,
          complianceRes,
          completionTimeRes,
          onTimeRes,
          velocityRes,
          healthRes,
          forecastRes,
          complianceTrendsRes,
          complianceResolutionRes,
        ] = await Promise.all([
          apiRequest(
            `/api/analytics/productivity?startDate=${productivityStartDate.toISOString()}&endDate=${endDate.toISOString()}`
          ),
          apiRequest('/api/analytics/workload'),
          apiRequest('/api/analytics/projects'),
          apiRequest('/api/analytics/priority'),
          apiRequest('/api/analytics/backlog'),
          apiRequest('/api/analytics/studies'),
          apiRequest('/api/analytics/compliance'),
          apiRequest(
            `/api/analytics/completion-time?startDate=${productivityStartDate.toISOString()}&endDate=${endDate.toISOString()}`
          ),
          apiRequest(
            `/api/analytics/on-time?startDate=${productivityStartDate.toISOString()}&endDate=${endDate.toISOString()}`
          ),
          apiRequest(
            `/api/analytics/velocity?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&period=day`
          ),
          apiRequest('/api/analytics/health'),
          apiRequest('/api/analytics/forecast'),
          apiRequest(
            `/api/analytics/compliance-trends?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&period=day`
          ),
          apiRequest('/api/analytics/compliance-resolution'),
        ]);

        // Check for errors and parse responses
        const responses = [
          { name: 'productivity', res: productivityRes },
          { name: 'workload', res: workloadRes },
          { name: 'projects', res: projectsRes },
          { name: 'priority', res: priorityRes },
          { name: 'backlog', res: backlogRes },
          { name: 'studies', res: studiesRes },
          { name: 'compliance', res: complianceRes },
        ];

        // Parse all responses (even if some failed, we'll handle empty data)
        const [
          productivity,
          workload,
          projects,
          priority,
          backlog,
          studies,
          compliance,
          completionTime,
          onTime,
          velocity,
          health,
          forecast,
          complianceTrends,
          complianceResolution,
        ] = await Promise.all([
          productivityRes.ok ? productivityRes.json() : Promise.resolve({ data: [] }),
          workloadRes.ok ? workloadRes.json() : Promise.resolve({ data: [] }),
          projectsRes.ok ? projectsRes.json() : Promise.resolve({ data: [] }),
          priorityRes.ok ? priorityRes.json() : Promise.resolve({ data: null }),
          backlogRes.ok ? backlogRes.json() : Promise.resolve({ data: [] }),
          studiesRes.ok ? studiesRes.json() : Promise.resolve({ data: [] }),
          complianceRes.ok ? complianceRes.json() : Promise.resolve({ data: null }),
          completionTimeRes.ok ? completionTimeRes.json() : Promise.resolve({ data: [] }),
          onTimeRes.ok ? onTimeRes.json() : Promise.resolve({ data: [] }),
          velocityRes.ok ? velocityRes.json() : Promise.resolve({ data: [] }),
          healthRes.ok ? healthRes.json() : Promise.resolve({ data: [] }),
          forecastRes.ok ? forecastRes.json() : Promise.resolve({ data: [] }),
          complianceTrendsRes.ok ? complianceTrendsRes.json() : Promise.resolve({ data: [] }),
          complianceResolutionRes.ok
            ? complianceResolutionRes.json()
            : Promise.resolve({ data: null }),
        ]);

        const analyticsData = {
          productivity: productivity.data || [],
          workload: workload.data || [],
          projects: projects.data || [],
          priority: priority.data || null,
          backlog: backlog.data || [],
          studies: studies.data || [],
          compliance: compliance.data || null,
          completionTime: completionTime.data || [],
          onTimeRate: onTime.data || [],
          velocity: velocity.data || [],
          health: health.data || [],
          forecast: forecast.data || [],
          complianceTrends: complianceTrends.data || [],
          complianceResolution: complianceResolution.data || null,
        };

        // Debug logging
        console.log('Analytics data received:', {
          productivity: analyticsData.productivity.length,
          workload: analyticsData.workload.length,
          projects: analyticsData.projects.length,
          priority: analyticsData.priority ? 'exists' : 'null',
          backlog: analyticsData.backlog.length,
          studies: analyticsData.studies.length,
          compliance: analyticsData.compliance ? 'exists' : 'null',
        });

        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Calculate summary metrics
  const totalProjects = analytics.projects.length;
  const totalStudies = analytics.studies.reduce((sum, s) => sum + s.studyCount, 0);
  const totalTasks = analytics.priority?.summary.totalTasks || 0;
  const completedTasks = analytics.priority?.summary.byPriority.reduce(
    (sum, p) => sum + (p.byStatus[TaskStatus.COMPLETED] || 0),
    0
  ) || 0;
  const activeTasks = analytics.workload.reduce((sum, w) => sum + w.activeTaskCount, 0);
  const highPriorityBacklog = analytics.backlog.length;
  const avgCompletionRate = analytics.productivity.length > 0
    ? analytics.productivity.reduce((sum, p) => sum + p.completionRate, 0) / analytics.productivity.length
    : 0;
  const avgOnTimeRate = analytics.onTimeRate.length > 0
    ? analytics.onTimeRate.reduce((sum, o) => sum + o.onTimeRate, 0) / analytics.onTimeRate.length
    : 0;

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Overview Dashboard</h1>
        <p className="text-gray-600">
          Key metrics and insights for your projects, studies, and tasks.
        </p>
      </div>

      {/* Key Metrics Summary */}
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

      {/* High Priority Backlog - Show prominently if there are urgent items */}
      {analytics.backlog.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-red-900">High Priority Backlog</h2>
              <p className="text-sm text-red-700 mt-1">
                {analytics.backlog.length} {analytics.backlog.length === 1 ? 'task' : 'tasks'} require immediate attention
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
                {analytics.backlog.slice(0, 5).map((item) => (
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
          {analytics.backlog.length > 5 && (
            <p className="text-sm text-red-700 mt-3">
              + {analytics.backlog.length - 5} more {analytics.backlog.length - 5 === 1 ? 'task' : 'tasks'}
            </p>
          )}
        </div>
      )}

      {/* Researcher Productivity Summary */}
      {analytics.productivity.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Researcher Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Researcher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Tasks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completion Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.productivity.map((item) => (
                  <tr key={item.researcherId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.researcher.name}</div>
                      <div className="text-sm text-gray-500">{item.researcher.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalTasks}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.completedTasks}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${item.completionRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.completionRate.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current Workload */}
      {analytics.workload.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Current Workload Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.workload.map((item) => (
              <div key={item.researcherId} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">{item.researcher.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Active Tasks:</span>
                    <span className="font-medium">{item.activeTaskCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-medium">{item.pendingCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">In Progress:</span>
                    <span className="font-medium">{item.inProgressCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Progress */}
      {analytics.projects.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Project Progress Overview</h2>
          <div className="space-y-4">
            {analytics.projects.map((project) => (
              <div key={project.projectId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900">{project.projectName}</h3>
                  <span className="text-sm font-medium text-gray-700">
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
                <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
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

      {/* Task Priority Distribution */}
      {analytics.priority && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Task Priority Distribution</h2>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Total Tasks: {analytics.priority.summary.totalTasks}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cancelled
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.priority.summary.byPriority.map((item) => (
                  <tr key={item.priority}>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.total}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.byStatus[TaskStatus.PENDING] || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.byStatus[TaskStatus.IN_PROGRESS] || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.byStatus[TaskStatus.COMPLETED] || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.byStatus[TaskStatus.CANCELLED] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Study Progress Distribution */}
      {analytics.studies.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Study Progress Distribution</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {analytics.studies.map((item) => (
              <div key={item.progressRange} className="border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600 mb-1">{item.studyCount}</div>
                <div className="text-sm text-gray-600">{item.progressRange}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average Completion Time */}
      {analytics.completionTime.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Average Task Completion Time</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Researcher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed Tasks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.completionTime.map((item) => (
                  <tr key={item.researcherId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.researcher.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.avgHoursToComplete.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.minHoursToComplete}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.maxHoursToComplete}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.completedCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* On-Time Completion Rate */}
      {analytics.onTimeRate.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">On-Time Completion Rate</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Researcher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total with Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    On-Time Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    On-Time Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.onTimeRate.map((item) => (
                  <tr key={item.researcherId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.researcher.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.totalWithDueDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.onTimeCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${item.onTimeRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
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
      )}

      {/* Project Velocity */}
      {analytics.velocity.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Project Velocity (Tasks Completed Per Day)</h2>
          <div className="space-y-4">
            {analytics.velocity.map((project) => (
              <div key={project.projectId} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">{project.projectName}</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
                  {project.velocity.slice(-10).map((period) => (
                    <div key={period.period} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{period.period}</div>
                      <div className="text-lg font-bold text-indigo-600">{period.count}</div>
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Project Health Scores</h2>
          <div className="space-y-4">
            {analytics.health.map((project) => (
              <div key={project.projectId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-900">{project.projectName}</h3>
                  <div className="flex items-center">
                    <div
                      className={`text-2xl font-bold ${
                        project.healthScore >= 80
                          ? 'text-green-600'
                          : project.healthScore >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {project.healthScore}
                    </div>
                    <span className="text-sm text-gray-500 ml-2">/ 100</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-500">Progress Score</div>
                    <div className="text-sm font-medium">{project.breakdown.progressScore} / 40</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Overdue Score</div>
                    <div className="text-sm font-medium">{project.breakdown.overdueScore} / 30</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Compliance Score</div>
                    <div className="text-sm font-medium">{project.breakdown.complianceScore} / 30</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs text-gray-600">
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

      {/* Study Completion Forecast */}
      {analytics.forecast.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Study Completion Forecast</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Study
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining Tasks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tasks/Day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Est. Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Forecasted Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.forecast.map((study) => (
                  <tr key={study.studyId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{study.studyName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
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
                        <span className="text-sm text-gray-900">{study.currentProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {study.remainingTasks} / {study.totalTasks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {study.tasksPerDay}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {study.estimatedDaysToComplete !== null
                        ? `${study.estimatedDaysToComplete} days`
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
      )}

      {/* Compliance Flag Trends */}
      {analytics.complianceTrends.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Compliance Flag Trends</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
            {analytics.complianceTrends.slice(-10).map((trend) => (
              <div key={trend.period} className="text-center border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{trend.period}</div>
                <div className="text-lg font-bold text-red-600">{trend.flagCount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Resolution Time */}
      {analytics.complianceResolution && analytics.complianceResolution.resolvedCount > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Compliance Flag Resolution Time</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Avg Hours to Resolve</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics.complianceResolution.avgHoursToResolve.toFixed(1)}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Min Hours</div>
              <div className="text-2xl font-bold text-green-600">
                {analytics.complianceResolution.minHoursToResolve}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Max Hours</div>
              <div className="text-2xl font-bold text-red-600">
                {analytics.complianceResolution.maxHoursToResolve}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Resolved Flags</div>
              <div className="text-2xl font-bold text-indigo-600">
                {analytics.complianceResolution.resolvedCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Metrics */}
      {analytics.compliance && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Compliance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.compliance.totalTasks}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Tasks with Flags</div>
              <div className="text-2xl font-bold text-orange-600">{analytics.compliance.tasksWithFlags}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Open Flags</div>
              <div className="text-2xl font-bold text-red-600">{analytics.compliance.totalOpenFlags}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Flag Rate</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.compliance.flagRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State - Only show if there's truly no data at all */}
      {analytics.productivity.length === 0 &&
        analytics.workload.length === 0 &&
        analytics.projects.length === 0 &&
        (!analytics.priority || analytics.priority.summary.totalTasks === 0) &&
        analytics.backlog.length === 0 &&
        analytics.studies.length === 0 &&
        (!analytics.compliance || analytics.compliance.totalTasks === 0) && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data Available</h3>
            <p className="text-sm text-gray-500 mb-4">
              {user?.role === 'Manager'
                ? 'Create projects, studies, and tasks to see analytics data.'
                : 'You need to be assigned tasks to see analytics data.'}
            </p>
            <div className="text-xs text-gray-400 mt-4">
              <p>Check the browser console for API response details.</p>
            </div>
          </div>
        )}
    </div>
  );
}
