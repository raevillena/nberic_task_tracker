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
import {
  AdminTaskMetrics,
  AdminTaskCompletionTrend,
  AdminTaskAssignmentMetrics,
  OverdueAdminTask,
} from '@/store/slices/analyticsSlice';
import { Suspense, lazy } from 'react';
import { SkeletonCardGrid } from '@/components/analytics/SkeletonCard';
import { SkeletonTable } from '@/components/analytics/SkeletonTable';
import { SkeletonAdminTaskMetrics } from '@/components/analytics/SkeletonAdminTaskMetrics';
import { SkeletonBacklog } from '@/components/analytics/SkeletonBacklog';

// Lazy load all analytics components
const AnalyticsSummaryCards = lazy(() => import('@/components/analytics/AnalyticsSummaryCards'));
const HighPriorityBacklog = lazy(() => import('@/components/analytics/HighPriorityBacklog'));
const AdminTaskMetricsComponent = lazy(() => import('@/components/analytics/AdminTaskMetrics'));
const DetailedAnalytics = lazy(() => import('@/components/analytics/DetailedAnalytics'));

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
  adminTaskMetrics: AdminTaskMetrics | null;
  adminTaskCompletionTrends: AdminTaskCompletionTrend[];
  adminTaskAssignments: AdminTaskAssignmentMetrics[];
  overdueAdminTasks: OverdueAdminTask[];
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

        // Phase 1: Fetch critical metrics first (above the fold)
        // Debug: Check token before making requests
        if (process.env.NODE_ENV === 'development') {
          // Use useAppSelector hook result instead of store.getState()
          // The user and auth state are already available via useAppSelector above
          console.log('[Dashboard] Fetching analytics, token check:', {
            hasUser: !!user,
            userId: user?.id,
            userRole: user?.role,
          });
        }

        const [
          workloadRes,
          projectsRes,
          priorityRes,
          backlogRes,
        ] = await Promise.all([
          apiRequest('/api/analytics/workload'),
          apiRequest('/api/analytics/projects'),
          apiRequest('/api/analytics/priority'),
          apiRequest('/api/analytics/backlog'),
        ]);

        // Parse critical responses
        const [
          workload,
          projects,
          priority,
          backlog,
        ] = await Promise.all([
          workloadRes.ok ? workloadRes.json() : Promise.resolve({ data: [] }),
          projectsRes.ok ? projectsRes.json() : Promise.resolve({ data: [] }),
          priorityRes.ok ? priorityRes.json() : Promise.resolve({ data: null }),
          backlogRes.ok ? backlogRes.json() : Promise.resolve({ data: [] }),
        ]);

        // Set initial data for immediate display (critical metrics only)
        setAnalytics({
          productivity: [],
          workload: workload.data || [],
          projects: projects.data || [],
          priority: priority.data || null,
          backlog: backlog.data || [],
          studies: [],
          compliance: null,
          completionTime: [],
          onTimeRate: [],
          velocity: [],
          health: [],
          forecast: [],
          complianceTrends: [],
          complianceResolution: null,
          adminTaskMetrics: null,
          adminTaskCompletionTrends: [],
          adminTaskAssignments: [],
          overdueAdminTasks: [],
        });
        // Set loading to false so skeleton is replaced with actual content
        // Suspense will handle lazy-loaded components
        setLoading(false);

        // Phase 2: Fetch non-critical analytics in background (lazy loaded)
        const [
          productivityRes,
          studiesRes,
          complianceRes,
          completionTimeRes,
          onTimeRes,
          velocityRes,
          healthRes,
          forecastRes,
          complianceTrendsRes,
          complianceResolutionRes,
          adminTaskMetricsRes,
          adminTaskCompletionTrendsRes,
          adminTaskAssignmentsRes,
          overdueAdminTasksRes,
        ] = await Promise.all([
          apiRequest(
            `/api/analytics/productivity?startDate=${productivityStartDate.toISOString()}&endDate=${endDate.toISOString()}`
          ),
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
          // Admin task metrics
          apiRequest('/api/analytics/admin-tasks/metrics'),
          apiRequest(
            `/api/analytics/admin-tasks/completion-trends?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&period=day`
          ),
          apiRequest('/api/analytics/admin-tasks/assignments'),
          apiRequest('/api/analytics/admin-tasks/overdue'),
        ]);

        // Parse non-critical responses (even if some failed, we'll handle empty data)
        const [
          productivity,
          studies,
          compliance,
          completionTime,
          onTime,
          velocity,
          health,
          forecast,
          complianceTrends,
          complianceResolution,
          adminTaskMetrics,
          adminTaskCompletionTrends,
          adminTaskAssignments,
          overdueAdminTasks,
        ] = await Promise.all([
          productivityRes.ok ? productivityRes.json() : Promise.resolve({ data: [] }),
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
          adminTaskMetricsRes.ok
            ? adminTaskMetricsRes.json()
            : Promise.resolve({ data: null }),
          adminTaskCompletionTrendsRes.ok
            ? adminTaskCompletionTrendsRes.json()
            : Promise.resolve({ data: [] }),
          adminTaskAssignmentsRes.ok
            ? adminTaskAssignmentsRes.json()
            : Promise.resolve({ data: [] }),
          overdueAdminTasksRes.ok
            ? overdueAdminTasksRes.json()
            : Promise.resolve({ data: [] }),
        ]);

        // Update analytics with complete data
        setAnalytics((prev) => ({
          ...prev!,
          productivity: productivity.data || [],
          studies: studies.data || [],
          compliance: compliance.data || null,
          completionTime: completionTime.data || [],
          onTimeRate: onTime.data || [],
          velocity: velocity.data || [],
          health: health.data || [],
          forecast: forecast.data || [],
          complianceTrends: complianceTrends.data || [],
          complianceResolution: complianceResolution.data || null,
          adminTaskMetrics: adminTaskMetrics?.data || null,
          adminTaskCompletionTrends: adminTaskCompletionTrends?.data || [],
          adminTaskAssignments: adminTaskAssignments?.data || [],
          overdueAdminTasks: overdueAdminTasks?.data || [],
        }));
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics. Please try again later.');
        setLoading(false);
      }
    }

    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  // Initial loading state with skeleton
  if (loading && !analytics) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="mb-6 sm:mb-8">
          <div className="h-7 sm:h-9 bg-gray-200 rounded w-48 sm:w-64 mb-2 animate-pulse"></div>
          <div className="h-4 sm:h-5 bg-gray-200 rounded w-full sm:w-96 animate-pulse"></div>
        </div>
        <SkeletonCardGrid count={4} />
        <SkeletonTable rows={3} cols={4} />
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

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Overview Dashboard</h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Key metrics and insights for your projects, studies, and tasks.
        </p>
      </div>

      {/* Critical Metrics - Lazy Loaded with Suspense */}
      <Suspense fallback={<SkeletonCardGrid count={4} />}>
        <AnalyticsSummaryCards analytics={analytics} />
      </Suspense>

      {/* High Priority Backlog - Lazy Loaded with Suspense */}
      <Suspense fallback={<SkeletonBacklog />}>
        <HighPriorityBacklog backlog={analytics.backlog} />
      </Suspense>

      {/* Admin Task Metrics - Lazy Loaded with Suspense */}
      {analytics.adminTaskMetrics && (
        <Suspense fallback={<SkeletonAdminTaskMetrics />}>
          <AdminTaskMetricsComponent
            metrics={analytics.adminTaskMetrics}
            completionTrends={analytics.adminTaskCompletionTrends}
            assignments={analytics.adminTaskAssignments}
            overdueTasks={analytics.overdueAdminTasks}
          />
        </Suspense>
      )}

      {/* Detailed Analytics - Lazy Loaded with Suspense */}
      <Suspense fallback={<SkeletonTable rows={5} cols={4} title />}>
        <DetailedAnalytics analytics={analytics} userRole={user?.role} />
      </Suspense>

      {/* Empty State - Only show if there's truly no data at all */}
      {analytics.productivity.length === 0 &&
        analytics.workload.length === 0 &&
        analytics.projects.length === 0 &&
        (!analytics.priority || analytics.priority.summary.totalTasks === 0) &&
        analytics.backlog.length === 0 &&
        analytics.studies.length === 0 &&
        (!analytics.compliance || analytics.compliance.totalTasks === 0) && (
          <div className="bg-white rounded-lg shadow-md p-8 sm:p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mb-4"
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
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Analytics Data Available</h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-4 px-4">
              {user?.role === 'Manager'
                ? 'Create projects, studies, and tasks to see analytics data.'
                : 'You need to be assigned tasks to see analytics data.'}
            </p>
          </div>
        )}
    </div>
  );
}
