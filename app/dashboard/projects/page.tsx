// Projects list page

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { 
  fetchProjectsThunk, 
  selectAllProjects, 
  deleteProjectThunk,
  selectProjectIsLoading,
} from '@/store/slices/projectSlice';
import { UserRole } from '@/types/entities';
import Link from 'next/link';
import { apiRequest } from '@/lib/utils/api';

export default function ProjectsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projects = useAppSelector(selectAllProjects);
  const isLoading = useAppSelector(selectProjectIsLoading);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    // Only fetch projects if user is authenticated
    // This prevents 401 errors when navigating before auth is initialized
    if (isAuthenticated && user) {
      dispatch(fetchProjectsThunk());
    }
  }, [dispatch, isAuthenticated, user]);

  const handleDelete = async (projectId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to move this project to trash? It can be restored later.')) {
      return;
    }

    try {
      setDeletingId(projectId);
      await dispatch(deleteProjectThunk(projectId)).unwrap();
      // Project will be removed from list automatically via Redux
    } catch (error) {
      alert('Failed to delete project: ' + (error as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // Mark project as read when clicked by researcher
  const handleProjectClick = async (projectId: number) => {
    if (user?.role === UserRole.RESEARCHER) {
      // Mark as read in the background (don't block navigation)
      // Use apiRequest to automatically include Authorization header
      apiRequest(`/api/projects/${projectId}/read`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(() => {
          // Trigger badge count refresh
          window.dispatchEvent(new CustomEvent('refreshUnreadCounts'));
        })
        .catch((error) => {
          // Silently fail - this is not critical
          console.error('Failed to mark project as read:', error);
        });
    }
    // Store referrer for back navigation
    const projectPath = `/dashboard/projects/${projectId}`;
    sessionStorage.setItem(`referrer:${projectPath}`, '/dashboard/projects');
    // Navigate to project detail
    router.push(projectPath);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage and track all your research projects</p>
        </div>
        {user?.role === 'Manager' && (
          <Link
            href="/dashboard/projects/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Create Project
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No projects</h3>
          <p className="mt-2 text-sm text-gray-500">
            {user?.role === 'Manager'
              ? 'Get started by creating a new project.'
              : 'No projects have been assigned to you yet.'}
          </p>
          {user?.role === 'Manager' && (
            <div className="mt-6">
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Project
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="relative p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 hover:border-indigo-300"
            >
              <div className="flex items-start justify-between mb-4">
                <button
                  onClick={() => handleProjectClick(project.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    {user?.role === 'Researcher' && !(project as any).isRead && (
                      <div className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0" title="Unread" />
                    )}
                    <h2 className={`text-xl font-semibold hover:text-indigo-600 transition-colors ${
                      user?.role === 'Researcher' && !(project as any).isRead 
                        ? 'text-indigo-700 font-bold' 
                        : 'text-gray-900'
                    }`}>
                      {project.name}
                    </h2>
                  </div>
                </button>
                <div className="flex items-center gap-2 ml-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.progress === 100
                        ? 'bg-green-100 text-green-800'
                        : project.progress > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {project.progress === 100 ? 'Completed' : project.progress > 0 ? 'In Progress' : 'Not Started'}
                  </span>
                  {user?.role === 'Manager' && (
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      disabled={deletingId === project.id}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move to trash"
                    >
                      {deletingId === project.id ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleProjectClick(project.id)}
                className="block w-full text-left"
              >
                {project.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{project.description}</p>
                )}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-semibold text-gray-900">{project.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        project.progress === 100
                          ? 'bg-green-600'
                          : project.progress > 0
                          ? 'bg-indigo-600'
                          : 'bg-gray-300'
                      }`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
