// Dashboard home page

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectsThunk, selectAllProjects } from '@/store/slices/projectSlice';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  // Use the selector to get projects array from normalized state
  const projects = useAppSelector(selectAllProjects);
  const isLoading = useAppSelector((state) => state.project.isLoading);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Only fetch projects if user is authenticated
    // This prevents 401 errors when navigating before auth is initialized
    if (isAuthenticated && user) {
      dispatch(fetchProjectsThunk());
    }
  }, [dispatch, isAuthenticated, user]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Projects</h1>
        {user?.role === 'Manager' && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <p className="text-sm sm:text-base text-gray-600 mb-3">
                Create and manage your research projects. Organize studies and tasks to track progress effectively.
              </p>
              <Link
                href="/dashboard/projects/new"
                className="block w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-center text-sm sm:text-base"
              >
                Create Project
              </Link>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-600">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No projects found. {user?.role === 'Manager' && 'Create your first project!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block p-4 sm:p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">{project.name}</h2>
              {project.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{project.description}</p>
              )}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm text-gray-600">Progress</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{project.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

