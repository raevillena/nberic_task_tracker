// Analytics Dashboard - Home page

'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
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
import AnalyticsSummaryCards from '@/components/analytics/AnalyticsSummaryCards';
import HighPriorityBacklog from '@/components/analytics/HighPriorityBacklog';

// Lazy load detailed analytics components
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

        // Set initial data for immediate display
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
        });
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
        }));
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

  // Loading state for critical metrics
  if (loading && !analytics) {
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

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Overview Dashboard</h1>
        <p className="text-gray-600">
          Key metrics and insights for your projects, studies, and tasks.
        </p>
      </div>

      {/* Critical Metrics - Loaded First */}
      <AnalyticsSummaryCards analytics={analytics} />
      <HighPriorityBacklog backlog={analytics.backlog} />

      {/* Detailed Analytics - Lazy Loaded with Suspense */}
      <Suspense
        fallback={
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600">Loading detailed analytics...</p>
          </div>
        }
      >
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
          </div>
        )}
    </div>
  );
}
